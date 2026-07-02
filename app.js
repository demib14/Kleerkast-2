const SUPABASE_URL='https://znsyaiaahsgwxdjishdy.supabase.co';
const SUPABASE_KEY='sb_publishable_LhX228oDFbuBZB4z2fFUPA_6ZdtTdbK';
const BUCKET='clothes';

const defaults=[
  {id:'tops',name:'Tops',color:'#dcf4e6'},
  {id:'bottoms',name:'Broeken en rokken',color:'#d9ecff'},
  {id:'dresses',name:'Jurken',color:'#ffe1e9'},
  {id:'jackets',name:'Jassen',color:'#fff0c9'},
  {id:'shoes',name:'Schoenen',color:'#eadfff'},
  {id:'bags',name:'Tassen',color:'#f1dfd2'},
  {id:'accessories',name:'Accessoires',color:'#e8f0ff'}
];

let data={};
let selected={tops:null,bottoms:null,shoes:null,bags:null};

function loadCategories(){
  try{
    const saved=localStorage.getItem('ecloset_categories_v34');
    if(saved)return JSON.parse(saved);
  }catch(e){}
  return defaults.map(c=>({...c}));
}

function saveCategories(){
  localStorage.setItem('ecloset_categories_v34',JSON.stringify(data.categories));
}

function prep(){
  const savedCategories=loadCategories();
  data={categories:savedCategories,purchase:[],outfits:[]};
  data.categories.forEach(c=>{data[c.id]=[]});
}

function ensureCategory(id){
  if(!data[id])data[id]=[];
}

function setStatus(text,type=''){
  let el=document.getElementById('cloudStatus');
  if(!el)return;
  el.textContent=text;
  el.className='cloud-status '+type;
}

async function cloudFetch(path,options={}){
  const res=await fetch(SUPABASE_URL+path,{
    ...options,
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:'Bearer '+SUPABASE_KEY,
      ...(options.headers||{})
    }
  });
  if(!res.ok){
    const t=await res.text();
    throw new Error(t||res.statusText);
  }
  return res;
}

async function loadCloud(){
  try{
    setStatus('☁️ Cloud laden...');
    const res=await cloudFetch('/rest/v1/clothing?select=*&order=created_at.desc');
    const rows=await res.json();

    const savedCategories=loadCategories();
    data={categories:savedCategories,purchase:[],outfits:[]};
    data.categories.forEach(c=>data[c.id]=[]);

    rows.forEach(row=>{
      const cat=row.category||'tops';

      // Als er cloudfoto's bestaan in een categorie die niet lokaal bestaat, maak die opnieuw zichtbaar.
      if(!data.categories.find(c=>c.id===cat)){
        data.categories.push({id:cat,name:cat,color:'#f1dfd2'});
        data[cat]=[];
        saveCategories();
      }

      ensureCategory(cat);
      data[cat].push({
        id:row.id,
        src:row.image_url,
        name:row.name||'',
        cloudId:row.id,
        brand:row.brand||'',
        color:row.color||'',
        season:row.season||'',
        favorite:!!row.favorite,
        notes:row.notes||''
      });
    });

    setStatus('☁️ Cloud actief — '+rows.length+' kledingstuk(ken)', 'ok');
    render();
  }catch(e){
    console.error(e);
    setStatus('⚠️ Cloud laden mislukt. Check Supabase-instellingen.', 'err');
    prep();
    render();
  }
}

function resizeToBlob(file,maxSize=900,quality=.72){
  return new Promise((ok,err)=>{
    let reader=new FileReader();
    reader.onload=e=>{
      let img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height,s=Math.min(1,maxSize/Math.max(w,h));
        w=Math.round(w*s);h=Math.round(h*s);
        let c=document.createElement('canvas');
        c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        c.toBlob(blob=>ok(blob),'image/jpeg',quality);
      };
      img.onerror=err;
      img.src=e.target.result;
    };
    reader.onerror=err;
    reader.readAsDataURL(file);
  });
}

function nav(screen){
  closeDrawer();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screen).classList.add('active');
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));
  scrollTo(0,0);
  render();
}

function openDrawer(){document.getElementById('settingsDrawer').classList.add('open')}
function closeDrawer(){document.getElementById('settingsDrawer').classList.remove('open')}
function pick(cat){document.getElementById('file-'+cat)?.click()}

async function uploadImage(file){
  const blob=await resizeToBlob(file);
  const filename='item-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.jpg';

  await cloudFetch('/storage/v1/object/'+BUCKET+'/'+filename,{
    method:'POST',
    headers:{'Content-Type':'image/jpeg','x-upsert':'true'},
    body:blob
  });

  return SUPABASE_URL+'/storage/v1/object/public/'+BUCKET+'/'+filename;
}

async function addPhotos(cat,files){
  const list=Array.from(files||[]);
  if(!list.length)return;

  let success=0;

  for(let i=0;i<list.length;i++){
    try{
      setStatus('☁️ Foto '+(i+1)+' van '+list.length+' uploaden...');
      const imageUrl=await uploadImage(list[i]);

      await cloudFetch('/rest/v1/clothing',{
        method:'POST',
        headers:{'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify({
          category:cat,
          name:'',
          image_url:imageUrl,
          brand:'',
          color:'',
          season:'',
          favorite:false,
          notes:''
        })
      });

      success++;
    }catch(e){
      console.error(e);
      alert('Upload gestopt bij foto '+(i+1)+'. '+success+' foto(s) zijn wel opgeslagen.');
      break;
    }
  }

  await loadCloud();
}

async function addPhoto(cat,file){
  return addPhotos(cat,file?[file]:[]);
}

async function delPhoto(cat,id){
  if(!confirm('Dit kledingstuk verwijderen uit de cloud?'))return;
  try{
    await cloudFetch('/rest/v1/clothing?id=eq.'+id,{method:'DELETE'});
    await loadCloud();
  }catch(e){
    console.error(e);
    alert('Verwijderen mislukt.');
  }
}

async function renamePhoto(cat,id){
  let p=data[cat].find(x=>x.id===id);
  if(!p)return;

  let name=prompt('Nieuwe naam?',p.name||'');
  if(name===null)return;

  try{
    await cloudFetch('/rest/v1/clothing?id=eq.'+id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name})
    });
    await loadCloud();
  }catch(e){
    alert('Naam wijzigen mislukt.');
  }
}

function select(cat,p,card){
  if(!(cat in selected))return;
  selected[cat]=p.id;
  document.getElementById('slot-'+cat).innerHTML='<img src="'+p.src+'">';
  document.querySelectorAll('[data-row="'+cat+'"] .item').forEach(i=>i.classList.remove('active'));
  card.classList.add('active');
}

function clearOutfit(){
  selected={tops:null,bottoms:null,shoes:null,bags:null};
  Object.entries({tops:'Top',bottoms:'Onderstuk',shoes:'Schoenen',bags:'Tas'}).forEach(([k,v])=>{
    document.getElementById('slot-'+k).textContent=v;
  });
  document.querySelectorAll('.item.active').forEach(i=>i.classList.remove('active'));
}

function saveOutfit(){
  if(!Object.values(selected).some(Boolean)){
    alert('Kies eerst minstens één kledingstuk.');
    return;
  }
  data.outfits.push({id:Date.now(),date:new Date().toLocaleDateString('nl-BE'),items:{...selected}});
  alert('Outfit bewaard');
}

function findImg(id){
  for(let c of data.categories){
    let m=(data[c.id]||[]).find(p=>p.id===id);
    if(m)return m.src;
  }
  return null;
}

function card(cat,p,sel,closet=false){
  let d=document.createElement('article');
  d.className='item';

  let img=document.createElement('img');
  img.src=p.src;
  if(sel)img.onclick=()=>select(cat,p,d);
  d.append(img);

  if(p.name){
    let n=document.createElement('div');
    n.className='item-name';
    n.textContent=p.name;
    d.append(n);
  }

  if(closet){
    let rename=document.createElement('button');
    rename.className='delete';
    rename.textContent='Naam';
    rename.onclick=()=>renamePhoto(cat,p.id);
    d.append(rename);
  }

  let b=document.createElement('button');
  b.className='delete';
  b.textContent='Verwijder';
  b.onclick=()=>delPhoto(cat,p.id);
  d.append(b);

  return d;
}

function row(cat,sel,closet=false){
  let r=document.createElement('div');
  r.className='row'+(closet?' closetrow':'');
  r.dataset.row=cat;

  if(!data[cat]?.length){
    let e=document.createElement('div');
    e.className='empty';
    e.textContent='Nog geen foto’s';
    r.append(e);
  }else{
    data[cat].forEach(p=>r.append(card(cat,p,sel,closet)));
  }

  return r;
}

function render(){
  renderStats();
  renderCloset();
  renderBuilder();
  renderPurchase();
  renderSaved();
  renderRecent();
  renderCats();
}

function renderStats(){
  let total=data.categories.reduce((sum,c)=>sum+((data[c.id]||[]).length),0);
  document.getElementById('closetStats').innerHTML='<div class="stat"><strong>'+total+'</strong><span>kledingstukken in cloud</span></div><div class="stat"><strong>'+data.categories.length+'</strong><span>categorieën</span></div>';
}

function renderCloset(){
  let c=document.getElementById('closetContent');
  c.innerHTML='';

  data.categories.forEach(cat=>{
    ensureCategory(cat.id);

    let block=document.createElement('section');
    block.className='cat-block';

    let h=document.createElement('div');
    h.className='cat-top';

    let left=document.createElement('div');
    left.innerHTML='<h2>'+cat.name+'</h2><div class="cat-count">'+((data[cat.id]||[]).length)+' stuk(s)</div>';

    let b=document.createElement('button');
    b.textContent='Foto toevoegen';
    b.onclick=()=>pick(cat.id);

    h.append(left,b);

    let input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.multiple=true;
    input.id='file-'+cat.id;
    input.onchange=e=>{
      addPhotos(cat.id,e.target.files);
      e.target.value='';
    };

    block.append(h,input,row(cat.id,false,true));
    c.append(block);
  });
}

function renderBuilder(){
  let c=document.getElementById('builderRows');
  c.innerHTML='';

  ['tops','bottoms','shoes','bags'].forEach(id=>{
    let cat=data.categories.find(x=>x.id===id);
    if(!cat)return;

    let h=document.createElement('h2');
    h.className='section';
    h.textContent=cat.name;
    c.append(h,row(id,true,false));
  });
}

function renderPurchase(){
  let c=document.getElementById('purchaseList');
  c.innerHTML='';
  let e=document.createElement('div');
  e.className='empty';
  e.textContent='Nieuwe aankoop cloud volgt later';
  c.append(e);
}

function renderSaved(){
  let c=document.getElementById('saved');
  c.innerHTML='';

  if(!data.outfits.length){
    let e=document.createElement('div');
    e.className='empty';
    e.textContent='Nog geen outfits bewaard';
    c.append(e);
    return;
  }
}

function renderRecent(){
  let c=document.getElementById('recent');
  c.innerHTML='';

  let imgs=[];
  data.categories.forEach(cat=>(data[cat.id]||[]).slice(0,1).forEach(p=>imgs.push(p.src)));

  if(!imgs.length){
    ['Werk outfit','Weekend','Date night','Zondag casual'].forEach(t=>{
      let e=document.createElement('div');
      e.className='empty';
      e.style.minWidth='220px';
      e.textContent=t;
      c.append(e);
    });
  }else{
    imgs.slice(0,4).forEach(src=>{
      let it=document.createElement('article');
      it.className='item active';
      it.innerHTML='<img src="'+src+'">';
      c.append(it);
    });
  }
}

function renderCats(){
  let c=document.getElementById('catList');
  c.innerHTML='';

  data.categories.forEach((cat,i)=>{
    let r=document.createElement('div');
    r.className='catrow';
    r.innerHTML='<div class="catleft"><span class="dot" style="background:'+cat.color+'"></span>'+cat.name+'</div>';

    let a=document.createElement('div');
    a.className='catactions';

    [
      ['Naam',()=>renameCat(cat.id)],
      ['↑',()=>moveCat(i,-1)],
      ['↓',()=>moveCat(i,1)],
      ['Verwijder',()=>deleteCat(cat.id)]
    ].forEach(x=>{
      let b=document.createElement('button');
      b.className='mini';
      b.textContent=x[0];
      b.onclick=x[1];
      a.append(b);
    });

    r.append(a);
    c.append(r);
  });
}

function addCat(){
  let name=prompt('Naam van nieuwe categorie?');
  if(!name)return;

  let colors=['#d9ecff','#dcf4e6','#ffe1e9','#fff0c9','#eadfff','#f1dfd2'];
  let id='cat_'+Date.now();

  data.categories.push({id,name,color:colors[data.categories.length%colors.length]});
  data[id]=[];
  saveCategories();
  render();
  closeDrawer();
}

function renameCat(id){
  let c=data.categories.find(x=>x.id===id);
  if(!c)return;

  let name=prompt('Nieuwe naam?',c.name);
  if(!name)return;

  c.name=name;
  saveCategories();
  render();
}

function moveCat(i,d){
  let n=i+d;
  if(n<0||n>=data.categories.length)return;

  [data.categories[i],data.categories[n]]=[data.categories[n],data.categories[i]];
  saveCategories();
  render();
}

function deleteCat(id){
  let cat=data.categories.find(c=>c.id===id);
  if(!cat)return;

  let count=(data[id]||[]).length;
  if(count>0){
    alert('Deze categorie bevat nog '+count+' foto(\\'s). Verwijder die eerst, zodat je niets per ongeluk kwijt bent.');
    return;
  }

  if(!confirm('Categorie "'+cat.name+'" verwijderen?'))return;

  data.categories=data.categories.filter(c=>c.id!==id);
  delete data[id];
  saveCategories();
  render();
}

function backup(){
  let blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  let a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='ecloset-backup.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

async function start(){
  prep();

  document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>nav(b.dataset.screen));
  document.getElementById('settingsBtn').onclick=openDrawer;
  document.getElementById('closetSettingsBtn').onclick=openDrawer;
  document.getElementById('closeDrawer').onclick=closeDrawer;

  document.getElementById('toggleAi').onclick=()=>{
    let a=document.getElementById('ai');
    a.classList.toggle('closed');
    document.getElementById('toggleAi').textContent=a.classList.contains('closed')?'⌄':'⌃';
  };

  document.getElementById('addCat').onclick=addCat;
  document.getElementById('drawerAddCat').onclick=addCat;
  document.getElementById('refreshCloud').onclick=loadCloud;
  document.getElementById('drawerRefresh').onclick=loadCloud;
  document.getElementById('backupBtn').onclick=backup;
  document.getElementById('drawerBackup').onclick=backup;
  document.getElementById('saveOutfit').onclick=saveOutfit;
  document.getElementById('clearOutfit').onclick=clearOutfit;
  document.getElementById('addPurchase').onclick=()=>pick('purchase');

  const purchase=document.getElementById('file-purchase');
  if(purchase){
    purchase.multiple=true;
    purchase.onchange=e=>{
      addPhotos('purchase',e.target.files);
      e.target.value='';
    };
  }

  await loadCloud();
}

start();
