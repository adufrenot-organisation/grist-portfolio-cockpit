/* GRIST PMO — Presence module
 * Table attendue: SESSIONS_UTILISATEURS
 * Le module est non bloquant: l'absence de table ne doit jamais empêcher le Cockpit de fonctionner.
 */
(function(){
  const TABLE="SESSIONS_UTILISATEURS";
  const HEARTBEAT_MS=120000; // 2 minutes
  const WIDGET="COCKPIT";

  function uuid(){
    try{return crypto.randomUUID()}catch(_){
      return "sess-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
    }
  }
  function sessionId(){
    const key="grist-pmo:presence:session";
    let id=sessionStorage.getItem(key);
    if(!id){id=uuid();sessionStorage.setItem(key,id)}
    return id;
  }
  function page(){
    try{
      if(window.currentTab==="docs")return "Documentation";
      if(window.currentTab==="offer")return "Offres de services";
      if(window.currentProjectId)return "Projet/Produit #"+window.currentProjectId;
    }catch(_){}
    const hash=location.hash||"";
    return hash.startsWith("#projet-")?hash.slice(1):"Portefeuille";
  }
  function rows(data){
    if(!data||!Array.isArray(data.id))return[];
    const keys=Object.keys(data);
    return data.id.map((_,i)=>Object.fromEntries(keys.map(k=>[k,Array.isArray(data[k])?data[k][i]:data[k]])));
  }
  function nowGrist(){return Math.floor(Date.now()/1000)}
  function badge(state,msg){
    const el=document.getElementById("presenceBadge");
    if(!el)return;
    el.className="presence-badge "+(
      state==="ok"?"presence-ok":state==="error"?"presence-error":"presence-pending"
    );
    el.textContent=state==="ok"?"● Présence active":state==="error"?"● Présence indisponible":"● Présence…";
    el.title=msg||"";
  }

  const Presence={
    table:TABLE,
    widget:WIDGET,
    version:null,
    rowId:null,
    timer:null,
    started:false,
    lastError:null,

    async ensureRow(){
      if(!window.grist?.docApi)throw new Error("API Grist indisponible");
      const sid=sessionId();
      const data=await grist.docApi.fetchTable(TABLE);
      const existing=rows(data).find(r=>String(r.Session_ID||"")===sid);
      if(existing){this.rowId=existing.id;return existing}

      const fields={
        Session_ID:sid,
        Widget_Code:this.widget,
        Widget_Version:this.version||"",
        Page:page(),
        Derniere_Activite:nowGrist()
      };
      await grist.docApi.applyUserActions([["AddRecord",TABLE,null,fields]]);
      const data2=await grist.docApi.fetchTable(TABLE);
      const created=rows(data2).find(r=>String(r.Session_ID||"")===sid);
      if(!created)throw new Error("Session créée mais ligne introuvable");
      this.rowId=created.id;
      return created;
    },

    async beat(){
      try{
        if(!this.rowId)await this.ensureRow();
        await grist.docApi.applyUserActions([["UpdateRecord",TABLE,this.rowId,{
          Widget_Code:this.widget,
          Widget_Version:this.version||"",
          Page:page(),
          Derniere_Activite:nowGrist()
        }]]);
        this.lastError=null;
        badge("ok",`Session ${sessionId()} · heartbeat toutes les 2 minutes`);
        return true;
      }catch(e){
        this.lastError=e;
        this.rowId=null;
        console.warn("PRESENCE",e);
        badge("error",`Table ${TABLE} absente/inaccessible : ${e?.message||e}`);
        return false;
      }
    },

    async start(opts={}){
      if(this.started)return;
      this.started=true;
      this.version=opts.version||"";
      this.widget=opts.widget||WIDGET;
      badge("pending",`Connexion à ${TABLE}…`);
      await this.beat();
      this.timer=setInterval(()=>this.beat(),HEARTBEAT_MS);

      // Rafraîchir aussi lors d'un retour sur l'onglet navigateur.
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="visible")this.beat();
      });
    },

    async touch(){return this.beat()}
  };

  window.PmoPresence=Presence;
})();
