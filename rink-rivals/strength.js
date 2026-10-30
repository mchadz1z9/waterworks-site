/* Rink Rivals strength: your Weightlifting progress, saved on this device. Working out raises it,
   and it makes your character look more muscular in the games that draw a person.
   The owner (a full admin) starts maxed out with an OWNER tag; reaching the top earns a Professional tag. */
(function(){ if(window.RRSTR) return;
  const K='rrStrength', MAX=100;
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  /* the owner: this device signed into /admin as full admin (flag saved there), or was granted full-admin access */
  const isOwner=()=>{ try{ if(localStorage.getItem('rrOwner')==='1') return true; }catch(e){} try{ return sessionStorage.getItem('rrRole')==='full'; }catch(e){ return false; } };
  let val=(()=>{ const n=+ls.get(K); return isFinite(n)?Math.max(0,Math.min(MAX,n)):0; })();
  function save(){ ls.set(K,String(Math.round(val))); try{ dispatchEvent(new CustomEvent('rrstr-change',{detail:RRSTR.state()})); }catch(e){} }
  const OWNER_LVL=1000;
  function level(){ return isOwner()?OWNER_LVL:Math.round(val); }      /* 0..100, owner shows 1000 */
  function frac(){ return isOwner()?1:Math.max(0,Math.min(1,val/MAX)); } /* 0..1 for the look */
  /* how much bigger the muscles get */
  function muscle(){ return 1+frac()*0.65; }
  function tag(){ if(isOwner()) return 'OWNER'; return level()>=MAX?'Professional':''; }
  /* short badge for chat / nameplates */
  function badge(){ if(isOwner()) return '👑 OWNER'; if(level()>=MAX) return '💪 PRO'; if(level()>=60) return '💪'; return ''; }
  const RRSTR={
    MAX, get owner(){ return isOwner(); }, get level(){ return level(); }, get frac(){ return frac(); },
    muscle, tag, badge,
    add(n){ if(isOwner()) return level(); val=Math.max(0,Math.min(MAX,val+(+n||0))); save(); return level(); },
    set(n){ val=Math.max(0,Math.min(MAX,+n||0)); save(); return level(); },
    state(){ return {level:level(),frac:frac(),owner:isOwner(),tag:tag(),badge:badge()}; } };
  window.RRSTR=RRSTR;
})();
