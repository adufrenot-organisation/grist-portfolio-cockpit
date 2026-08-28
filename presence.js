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

  

  presence.currentUser=async function(){
    try{
      if(!this.rowId)await this.ensureRow();
      const raw=await grist.docApi.fetchTable(TABLE);
      const row=tableRows(raw).find(r=>Number(r.id)===Number(this.rowId));
      return row?{
        email:String(row.Utilisateur_Email||"").trim(),
        name:String(row.Utilisateur_Nom||"").trim()
      }:{email:"",name:""};
    }catch(e){
      console.warn("[PRESENCE currentUser]",e);
      return {email:"",name:""};
    }
  };

  presence.activeWithinMinutes=10;

  presence.listActive=async function(opts={}){
    const raw=await grist.docApi.fetchTable(TABLE);
    const cutoff=Date.now()/1000-(opts.minutes||this.activeWithinMinutes)*60;
    const allWidgets=opts.allWidgets!==false;
    const currentWidget=opts.widget||this.widget;
    const active=tableRows(raw).filter(r=>{
      const ts=Number(r.Derniere_Activite||0);
      return ts>=cutoff && (allWidgets || String(r.Widget_Code||"")===currentWidget);
    });

    // One user line, even with several browser tabs/sessions.
    const grouped=new Map();
    for(const r of active){
      const identity=String(r.Utilisateur_Email||r.Utilisateur_Nom||r.Session_ID||`#${r.id}`);
      const key=identity.toLowerCase();
      const previous=grouped.get(key);
      if(!previous){
        grouped.set(key,{...r,sessions:1,pages:new Set([r.Page||""]),widgets:new Set([r.Widget_Code||""])});
      }else{
        previous.sessions++;
        previous.pages.add(r.Page||"");
        previous.widgets.add(r.Widget_Code||"");
        if(Number(r.Derniere_Activite||0)>Number(previous.Derniere_Activite||0)){
          previous.Derniere_Activite=r.Derniere_Activite;
          previous.Page=r.Page;
          previous.Widget_Code=r.Widget_Code;
          previous.Widget_Version=r.Widget_Version;
        }
      }
    }
    return [...grouped.values()].sort((a,b)=>Number(b.Derniere_Activite||0)-Number(a.Derniere_Activite||0));
  };

window.PmoPresence=presence;
})();
