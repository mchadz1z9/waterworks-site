/* Arcade Rivals strength: your Weightlifting progress, saved on this device. Working out raises it,
   it makes your character look more muscular in the games that draw a person, and it makes the bar
   feel lighter in the gym.
   Tags (set by an admin, read from the chat) give a head start: OWNER starts at 10,000 strength, gains
   100,000 more every rep (or cardio lap) and can lift the heaviest bar, VIP starts at 100, PRO starts at 75. A full admin signed in on this device is the owner too. */
(function(){ if(window.RRSTR) return;
  const K='rrStrength', MAX=100, OWNER_LVL=10000, FLOOR={VIP:100,PRO:75};
  const ls={ get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  const myTag=()=>String(ls.get('rrMyTag')||'').toLowerCase();
  const isOwner=()=>{ if(ls.get('rrOwner')==='1'||/\bowner\b/.test(myTag())) return true; try{ return sessionStorage.getItem('rrRole')==='full'; }catch(e){ return false; } };
  const tier=()=>{ const t=myTag(); if(/\bvip\b/.test(t)) return 'VIP'; if(/\bpro\b|professional/.test(t)) return 'PRO'; return ''; };
  let val=(()=>{ const n=+ls.get(K); return isFinite(n)?Math.max(0,n):0; })();   /* no cap any more: keep training, keep getting stronger */
  let workouts=(()=>{ const n=+ls.get('rrWorkouts'); return isFinite(n)?Math.max(0,n):0; })();
  /* the more you train, the more each workout gives: x1 for a beginner, up to x5 after lots of workouts */
  const trainMul=()=>1+Math.min(4,workouts/40);
  /* the owner's strength is its own number: starts at 10,000 and every rep adds another 100,000 */
  let ownerVal=(()=>{ const n=+ls.get('rrOwnerStr'); return isFinite(n)&&n>=OWNER_LVL?n:OWNER_LVL; })();
  const base=()=>Math.max(val,FLOOR[tier()]||0);
  function changed(){ try{ dispatchEvent(new CustomEvent('rrstr-change',{detail:RRSTR.state()})); }catch(e){} }
  function save(){ ls.set(K,String(Math.round(val))); changed(); }
  function level(){ return isOwner()?Math.round(ownerVal):Math.round(base()); }   /* 0..100; the owner starts at 10,000 and keeps climbing */
  function frac(){ return isOwner()?1:Math.max(0,Math.min(1,base()/MAX)); }        /* 0..1 for the look */
  function muscle(){ return isOwner()?1.7:1+frac()*0.65; }                          /* how much bigger the muscles get (owner: the most) */
  function tag(){ if(isOwner()) return 'OWNER'; const t=tier(); if(t) return t; return level()>=MAX?'Professional':''; }
  function badge(){ if(isOwner()) return '👑 OWNER'; const t=tier(); if(t==='VIP') return '⭐ VIP'; if(t==='PRO'||level()>=MAX) return '💪 PRO'; if(level()>=60) return '💪'; return ''; }
  const RRSTR={
    MAX, get owner(){ return isOwner(); }, get level(){ return level(); }, get frac(){ return frac(); }, get tier(){ return tier(); },
    muscle, tag, badge,
    add(n){ try{ if(JSON.parse(localStorage.getItem('rrSiteEvents')||'{}').str2x) n=(+n||0)*2; }catch(e){} if(isOwner()){ ownerVal+=100000; ls.set('rrOwnerStr',String(ownerVal)); changed(); return level(); } n=+n||0; if(n>0){ workouts++; ls.set('rrWorkouts',String(workouts)); n*=trainMul(); } val=Math.max(0,val+n); save(); return level(); },
    get workouts(){ return workouts; }, get multiplier(){ return +trainMul().toFixed(2); },
    /* spend strength (the potion shop). false if you don't have enough */
    spend(n){ n=Math.max(0,+n||0); if(level()<n) return false; if(isOwner()){ ownerVal=Math.max(OWNER_LVL,ownerVal-n); ls.set('rrOwnerStr',String(ownerVal)); changed(); return true; } val=Math.max(0,base()-n); save(); return true; },
    set(n){ val=Math.max(0,+n||0); save(); return level(); },
    state(){ return {level:level(),frac:frac(),owner:isOwner(),tier:tier(),tag:tag(),badge:badge()}; } };
  window.RRSTR=RRSTR;
  /* keep our tag in step with what the admin gave us (the chat sends everyone's tags) */
  addEventListener('rrc-who',e=>{ const me=(e.detail||[]).find(p=>p&&p.me); if(!me) return; const nt=String(me.tag||''); if(nt!==String(ls.get('rrMyTag')||'')){ ls.set('rrMyTag',nt); changed(); } });
})();
