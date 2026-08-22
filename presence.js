/* GRIST PMO — module de présence partagé
 * V1.0 — Cockpit
 * Table attendue : SESSIONS_UTILISATEURS
 */
(function(){
  const TABLE="SESSIONS_UTILISATEURS";
  const HEARTBEAT_MS=120000; // 2 minutes

  function makeId(){
    try{return crypto.randomUUID()}
    catch(_){return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
  }
  function getSessionId(){
    const k="grist-pmo:presence:session";
    let v=sessionStorage.getItem(k);
    if(!v){v=makeId();sessionStorage.setItem(k,v)}
    return v;
  }
  function tableRows(data){
    if(!data||!Array.isArray(data.id))return[];
    const keys=Object.keys(data);
    return data.id.map((_,i)=>Object.fromEntries(keys.map(k=>[k,Array.isArray(data[k])?data[k][i]:data[k]])));
  }
  function gristNow(){return Math.floor(Date.now()/1000)}
  function setBadge(state,detail){
    const el=document.getElementById("presenceBadge");
    if(!el)return;
    el.className=`presence-badge presence-${state}`;
    el.textContent=state==="ok"?"● Présence active":state==="error"?"● Présence indisponible":"● Présence…";
    el.title=detail||"";
  }

  const presence={
    widget:"COCKPIT",
    version:"",
    rowId:null,
    timer:null,
    started:false,
    pageProvider:()=>document.title||"Cockpit",

    async ensureRow(){
      const sid=getSessionId();
      const raw=await grist.docApi.fetchTable(TABLE);
      const found=tableRows(raw).find(r=>String(r.Session_ID||"")===sid);
      if(found){this.rowId=found.id;return}
      await grist.docApi.applyUserActions([["AddRecord",TABLE,null,{
        Session_ID:sid,
        Widget_Code:this.widget,
        Widget_Version:this.version,
        Page:this.pageProvider(),
        Derniere_Activite:gristNow()
      }]]);
      const raw2=await grist.docApi.fetchTable(TABLE);
      const created=tableRows(raw2).find(r=>String(r.Session_ID||"")===sid);
      if(!created)throw new Error("Session créée mais non retrouvée");
      this.rowId=created.id;
    },

    async beat(){
      try{
        if(!this.rowId)await this.ensureRow();
        await grist.docApi.applyUserActions([["UpdateRecord",TABLE,this.rowId,{
          Widget_Code:this.widget,
          Widget_Version:this.version,
          Page:this.pageProvider(),
          Derniere_Activite:gristNow()
        }]]);
        setBadge("ok",`Heartbeat toutes les 2 minutes · ${this.pageProvider()}`);
        return true;
      }catch(e){
        this.rowId=null;
        console.warn("[PRESENCE]",e);
        setBadge("error",`Table ${TABLE} absente ou inaccessible : ${e?.message||e}`);
        return false;
      }
    },

    async start(opts={}){
      if(this.started)return;
      this.started=true;
      this.widget=opts.widget||this.widget;
      this.version=opts.version||"";
      this.pageProvider=typeof opts.getPage==="function"?opts.getPage:this.pageProvider;
      setBadge("pending",`Connexion à ${TABLE}…`);
      await this.beat();
      this.timer=setInterval(()=>this.beat(),HEARTBEAT_MS);
      document.addEventListener("visibilitychange",()=>{
        if(document.visibilityState==="visible")this.beat();
      });
    },

    touch(){if(this.started)return this.beat()}
  };

  window.PmoPresence=presence;
})();
