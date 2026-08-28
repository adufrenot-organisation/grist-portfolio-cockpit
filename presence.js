/* GRIST PMO — Présence partagée v2
 * Source de vérité : SESSIONS_UTILISATEURS
 * Compatible avec le schéma historique Widget_Code/Page.
 * Colonnes v2 recommandées : Module, Contexte, Contexte_ID, Actif.
 */
(function(){
  const TABLE="SESSIONS_UTILISATEURS";
  const HEARTBEAT_MS=60000;
  const ACTIVE_MINUTES=10;

  function makeId(){try{return crypto.randomUUID()}catch(_){return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}}
  function getSessionId(){
    const k="grist-pmo:presence:v2:session";
    let v=sessionStorage.getItem(k);
    if(!v){v=makeId();sessionStorage.setItem(k,v)}
    return v;
  }
  function rows(data){
    if(!data||!Array.isArray(data.id))return[];
    const keys=Object.keys(data);
    return data.id.map((_,i)=>Object.fromEntries(keys.map(k=>[k,Array.isArray(data[k])?data[k][i]:data[k]])));
  }
  function now(){return Math.floor(Date.now()/1000)}
  function has(raw,k){return raw && Object.prototype.hasOwnProperty.call(raw,k)}
  function setBadge(state,detail){
    const el=document.getElementById("presenceBadge");if(!el)return;
    el.className=`presence-badge presence-${state}`;
    el.textContent=state==="ok"?"● Présence active":state==="error"?"● Présence indisponible":"● Présence…";
    el.title=detail||"";
  }

  const presence={
    widget:"MODULE",
    version:"",
    rowId:null,
    timer:null,
    started:false,
    getContext:()=>({module:"Module",context:document.title||"",contextId:""}),

    async schema(){
      const raw=await grist.docApi.fetchTable(TABLE);
      return {raw,rows:rows(raw)};
    },
    payload(raw){
      const ctx=this.getContext()||{};
      const module=String(ctx.module||this.widget||"Module");
      const context=String(ctx.context||ctx.page||document.title||"");
      const contextId=ctx.contextId??ctx.id??"";
      const p={};
      const put=(k,v)=>{if(has(raw,k))p[k]=v};
      put("Widget_Code",this.widget);
      put("Widget_Version",this.version);
      put("Page",context);
      put("Module",module);
      put("Contexte",context);
      put("Contexte_ID",contextId===null||contextId===undefined?"":String(contextId));
      put("Derniere_Activite",now());
      put("Actif",true);
      return p;
    },
    async ensureRow(){
      const sid=getSessionId();
      const {raw,rows:all}=await this.schema();
      const found=all.find(r=>String(r.Session_ID||"")===sid);
      if(found){this.rowId=found.id;return raw}
      const fields=this.payload(raw);
      if(has(raw,"Session_ID"))fields.Session_ID=sid;
      await grist.docApi.applyUserActions([["AddRecord",TABLE,null,fields]]);
      const after=await grist.docApi.fetchTable(TABLE);
      const created=rows(after).find(r=>String(r.Session_ID||"")===sid);
      if(!created)throw new Error("Session créée mais non retrouvée. Vérifiez la colonne Session_ID.");
      this.rowId=created.id;
      return after;
    },
    async beat(){
      try{
        let raw;
        if(!this.rowId)raw=await this.ensureRow();else raw=await grist.docApi.fetchTable(TABLE);
        await grist.docApi.applyUserActions([["UpdateRecord",TABLE,this.rowId,this.payload(raw)]]);
        const ctx=this.getContext()||{};
        setBadge("ok",`${ctx.module||this.widget} · ${ctx.context||""}`);
        return true;
      }catch(e){
        this.rowId=null;
        console.warn("[PRESENCE V2]",e);
        setBadge("error",`Table ${TABLE} absente/inaccessible : ${e?.message||e}`);
        return false;
      }
    },
    async start(opts={}){
      if(this.started)return;
      this.started=true;
      this.widget=opts.widget||this.widget;
      this.version=opts.version||"";
      if(typeof opts.getContext==="function")this.getContext=opts.getContext;
      else if(typeof opts.getPage==="function")this.getContext=()=>({module:this.widget,context:opts.getPage(),contextId:""});
      setBadge("pending",`Connexion à ${TABLE}…`);
      await this.beat();
      this.timer=setInterval(()=>this.beat(),HEARTBEAT_MS);
      document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")this.beat()});
    },
    touch(){if(this.started)return this.beat()},
    async currentUser(){
      try{
        if(!this.rowId)await this.ensureRow();
        const raw=await grist.docApi.fetchTable(TABLE);
        const row=rows(raw).find(r=>Number(r.id)===Number(this.rowId));
        return row?{email:String(row.Utilisateur_Email||"").trim(),name:String(row.Utilisateur_Nom||"").trim()}:{email:"",name:""};
      }catch(e){console.warn("[PRESENCE currentUser]",e);return {email:"",name:""}}
    },
    async listActive(opts={}){
      const raw=await grist.docApi.fetchTable(TABLE);
      const cutoff=Date.now()/1000-(opts.minutes||ACTIVE_MINUTES)*60;
      const allModules=opts.allWidgets!==false && opts.allModules!==false;
      const wanted=String(opts.widget||opts.module||this.widget||"");
      const active=rows(raw).filter(r=>{
        const ts=Number(r.Derniere_Activite||0);
        const mod=String(r.Module||r.Widget_Code||"");
        return ts>=cutoff && (!has(raw,"Actif") || r.Actif!==false) && (allModules||mod===wanted);
      });
      // Une ligne par utilisateur + module. Deux modules ouverts restent visibles séparément.
      const grouped=new Map();
      for(const r of active){
        const identity=String(r.Utilisateur_Email||r.Utilisateur_Nom||r.Session_ID||`#${r.id}`);
        const module=String(r.Module||r.Widget_Code||"Module");
        const key=`${identity.toLowerCase()}::${module.toLowerCase()}`;
        const enriched={...r,Module:module,Contexte:r.Contexte||r.Page||"",Contexte_ID:r.Contexte_ID||"",sessions:1};
        const prev=grouped.get(key);
        if(!prev)grouped.set(key,enriched);
        else{
          prev.sessions++;
          if(Number(r.Derniere_Activite||0)>Number(prev.Derniere_Activite||0))Object.assign(prev,enriched,{sessions:prev.sessions});
        }
      }
      return [...grouped.values()].sort((a,b)=>Number(b.Derniere_Activite||0)-Number(a.Derniere_Activite||0));
    }
  };
  window.PmoPresence=presence;
})();