const SUPABASE_URL='https://znsyaiaahsgwxdjishdy.supabase.co';
const SUPABASE_KEY='sb_publishable_LhX228oDFbuBZB4z2fFUPA_6ZdtTdbK';
const BUCKET='clothes';

const DEFAULT_CATEGORIES=[
  {id:'tops',name:'Tops',color:'#dcf4e6'},
  {id:'bottoms',name:'Broeken en rokken',color:'#d9ecff'},
  {id:'dresses',name:'Jurken',color:'#ffe1e9'},
  {id:'jackets',name:'Jassen',color:'#fff0c9'},
  {id:'shoes',name:'Schoenen',color:'#eadfff'},
  {id:'bags',name:'Tassen',color:'#f1dfd2'},
  {id:'accessories',name:'Accessoires',color:'#e8f0ff'}
];

let categories=[];
let items=[];
let outfits=[];
let selected={tops:null,bottoms:null,shoes:null,bags:null};

function loadCategories(){
  try{
    const saved=localStorage.getItem('ecloset_categories_1');
    if(saved)return JSON.parse(saved);
  }catch(e){}
  return DEFAULT_CATEGORIES.map(c=>({...c}));
}

function saveCategories(){
  localStorage.setItem('ecloset_categories_1',JSON.stringify(categories));
}

function setStatus(text,type=''){
  const el=document.getElementById('cloudStatus');
  if(!el)return;
  el.textContent=text;
  el.className='cloud '+type;
}

async function api(path,options={}){
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
    const res=await api('/rest/v1/clothing?select=*&order=created_at.desc');
    items=await res.json();

    // Toon onbekende categorieën toch, zodat foto's nooit "verdwijnen".
    items.forEach(item=>{
      const cat=item.category||'tops';
      if(!categories.find(c=>c.id===cat)){
        categories.push({id:cat,name:cat,color:'#f1dfd2'});
      }
    });
    saveCategories();

    setStatus('☁️ Cloud actief — '+items.length+' kledingstuk(ken)','ok');
    renderAll();
  }catch(e){
    console.error(e);
    setStatus('⚠️ Cloud laden mislukt','err');
    renderAll();
  }
}

function resizeToBlob(file,maxSize=900,quality=.72){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        let w=img.width,h=img.height;
        const scale=Math.min(1,maxSize/Math.max(w,h));
        w=Math.round(w*scale); h=Math.round(h*scale);
        const canvas=document.createElement('canvas');
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(blob=>resolve(blob),'image/jpeg',quality);
      };
      img.onerror=reject;
      img.src=e.target.result;
    };
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file){
  const blob=await resizeToBlob(file);
  const filename='item-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.jpg';
  await api('/storage/v1/object/'+BUCKET+'/'+filename,{
    method:'POST',
    headers:{'Content-Type':'image/jpeg','x-upsert':'true'},
    body:blob
  });
  return SUPABASE_URL+'/storage/v1/object/public/'+BUCKET+'/'+filename;
}

async function addPhotos(category,files){
  const list=Array.from(files||[]);
  if(!list.length)return;

  let success=0;
  for(let i=0;i<list.length;i++){
    try{
      setStatus('☁️ Foto '+(i+1)+' van '+list.length+' uploaden...');
      const url=await uploadImage(list[i]);
      await api('/rest/v1/clothing',{
        method:'POST',
        headers:{'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify({
          category,
          name:'',
          image_url:url,
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
      alert('Upload gestopt bij foto '+(i+1)+'. '+success+' foto(s) zijn opgeslagen.');
      break;
    }
  }
  await loadCloud();
}

async function deleteItem(id){
  if(!confirm('Dit kledingstuk verwijderen uit de cloud?'))return;
  try{
    await api('/rest/v1/clothing?id=eq.'+id,{method:'DELETE'});
    await loadCloud();
  }catch(e){
    console.error(e);
    alert('Verwijderen mislukt.');
  }
}

async function renameItem(id){
  const item=items.find(x=>x.id===id);
  if(!item)return;
  const name=prompt('Naam van kledingstuk?',item.name||'');
  if(name===null)return;
  try{
    await api('/rest/v1/clothing?id=eq.'+id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name})
    });
    await loadCloud();
  }catch(e){
    alert('Naam wijzigen mislukt.');
  }
}

function navigate(screen){
  closeDrawer();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screen).classList.add('active');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.screen===screen));
  window.scrollTo(0,0);
  renderAll();
}

function openDrawer(){document.getElementById('drawer').classList.add('open')}
function closeDrawer(){document.getElementById('drawer').classList.remove('open')}
function pick(category){document.getElementById('file-'+category)?.click()}

function itemsFor(category){
  return items.filter(item=>(item.category||'tops')===category);
}

function createCard(item,selectable=false,closet=false){
  const card=document.createElement('article');
  card.className='item';

  const img=document.createElement('img');
  img.src=item.image_url;
  if(selectable){
    img.onclick=()=>{
      selected[item.category]=item.id;
      const slot=document.getElementById('slot-'+item.category);
      if(slot)slot.innerHTML='<img src="'+item.image_url+'">';
      document.querySelectorAll('[data-row="'+item.category+'"] .item').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
    };
  }
  card.appendChild(img);

  if(item.name){
    const name=document.createElement('div');
    name.className='itemName';
    name.textContent=item.name;
    card.appendChild(name);
  }

  if(closet){
    const rename=document.createElement('button');
    rename.className='delete';
    rename.textContent='Naam';
    rename.onclick=()=>renameItem(item.id);
    card.appendChild(rename);
  }

  const del=document.createElement('button');
  del.className='delete';
  del.textContent='Verwijder';
  del.onclick=()=>deleteItem(item.id);
  card.appendChild(del);

  return card;
}

function createRow(category,selectable=false,closet=false){
  const row=document.createElement('div');
  row.className='row '+(closet?'closetRow':'');
  row.dataset.row=category;
  const list=itemsFor(category);

  if(!list.length){
    const empty=document.createElement('div');
    empty.className='empty';
    empty.textContent='Nog geen foto’s';
    row.appendChild(empty);
  }else{
    list.forEach(item=>row.appendChild(createCard(item,selectable,closet)));
  }
  return row;
}

function renderStats(){
  document.getElementById('stats').innerHTML=
    '<div class="stat"><strong>'+items.length+'</strong><span>kledingstukken in cloud</span></div>'+
    '<div class="stat"><strong>'+categories.length+'</strong><span>categorieën</span></div>';
}

function renderCloset(){
  const container=document.getElementById('closetContent');
  container.innerHTML='';

  categories.forEach(cat=>{
    const block=document.createElement('section');
    block.className='catBlock';

    const top=document.createElement('div');
    top.className='catTop';

    const left=document.createElement('div');
    left.innerHTML='<h2>'+cat.name+'</h2><div class="catCount">'+itemsFor(cat.id).length+' stuk(s)</div>';

    const btn=document.createElement('button');
    btn.textContent='Foto toevoegen';
    btn.onclick=()=>pick(cat.id);

    const input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.multiple=true;
    input.id='file-'+cat.id;
    input.onchange=e=>{
      addPhotos(cat.id,e.target.files);
      e.target.value='';
    };

    top.append(left,btn);
    block.append(top,input,createRow(cat.id,false,true));
    container.appendChild(block);
  });
}

function renderBuilder(){
  const container=document.getElementById('builderContent');
  container.innerHTML='';
  ['tops','bottoms','shoes','bags'].forEach(id=>{
    const cat=categories.find(c=>c.id===id);
    if(!cat)return;
    const title=document.createElement('h2');
    title.className='section';
    title.textContent=cat.name;
    container.append(title,createRow(id,true,false));
  });
}

function renderRecent(){
  const container=document.getElementById('recent');
  container.innerHTML='';
  const recent=items.slice(0,4);
  if(!recent.length){
    ['Werk outfit','Weekend','Date night','Zondag casual'].forEach(t=>{
      const e=document.createElement('div');
      e.className='empty';
      e.style.minWidth='220px';
      e.textContent=t;
      container.appendChild(e);
    });
  }else{
    recent.forEach(item=>{
      const c=document.createElement('article');
      c.className='item active';
      c.innerHTML='<img src="'+item.image_url+'">';
      container.appendChild(c);
    });
  }
}

function renderPurchase(){
  const c=document.getElementById('purchaseContent');
  c.innerHTML='';
  const e=document.createElement('div');
  e.className='empty';
  e.textContent='Nieuwe aankoop volgt in de volgende stap';
  c.appendChild(e);
}

function renderOutfits(){
  const c=document.getElementById('savedOutfits');
  c.innerHTML='';
  const e=document.createElement('div');
  e.className='empty';
  e.textContent='Nog geen outfits bewaard';
  c.appendChild(e);
}

function renderCategories(){
  const c=document.getElementById('categoryList');
  c.innerHTML='';

  categories.forEach((cat,index)=>{
    const row=document.createElement('div');
    row.className='catrow';
    row.innerHTML='<div class="catleft"><span class="dot" style="background:'+cat.color+'"></span>'+cat.name+'</div>';

    const actions=document.createElement('div');
    actions.className='catactions';

    [
      ['Naam',()=>renameCategory(cat.id)],
      ['↑',()=>moveCategory(index,-1)],
      ['↓',()=>moveCategory(index,1)],
      ['Verwijder',()=>deleteCategory(cat.id)]
    ].forEach(([label,fn])=>{
      const b=document.createElement('button');
      b.className='mini';
      b.textContent=label;
      b.onclick=fn;
      actions.appendChild(b);
    });

    row.appendChild(actions);
    c.appendChild(row);
  });
}

function addCategory(){
  const name=prompt('Naam van nieuwe categorie?');
  if(!name)return;
  const colors=['#d9ecff','#dcf4e6','#ffe1e9','#fff0c9','#eadfff','#f1dfd2'];
  categories.push({id:'cat_'+Date.now(),name,color:colors[categories.length%colors.length]});
  saveCategories();
  renderAll();
  closeDrawer();
}

function renameCategory(id){
  const cat=categories.find(c=>c.id===id);
  if(!cat)return;
  const name=prompt('Nieuwe naam?',cat.name);
  if(!name)return;
  cat.name=name;
  saveCategories();
  renderAll();
}

function moveCategory(index,dir){
  const next=index+dir;
  if(next<0||next>=categories.length)return;
  [categories[index],categories[next]]=[categories[next],categories[index]];
  saveCategories();
  renderAll();
}

function deleteCategory(id){
  const cat=categories.find(c=>c.id===id);
  if(!cat)return;
  const count=itemsFor(id).length;
  if(count>0){
    alert('Deze categorie bevat nog '+count+' foto(\'s). Verwijder die eerst, zodat je niets per ongeluk kwijt bent.');
    return;
  }
  if(!confirm('Categorie "'+cat.name+'" verwijderen?'))return;
  categories=categories.filter(c=>c.id!==id);
  saveCategories();
  renderAll();
}

function saveOutfit(){
  if(!Object.values(selected).some(Boolean)){
    alert('Kies eerst minstens één kledingstuk.');
    return;
  }
  alert('Outfits bewaren werken we in de volgende stap verder af.');
}

function clearOutfit(){
  selected={tops:null,bottoms:null,shoes:null,bags:null};
  Object.entries({tops:'Top',bottoms:'Onderstuk',shoes:'Schoenen',bags:'Tas'}).forEach(([id,label])=>{
    document.getElementById('slot-'+id).textContent=label;
  });
  document.querySelectorAll('.item.active').forEach(c=>c.classList.remove('active'));
}

function renderAll(){
  renderStats();
  renderCloset();
  renderBuilder();
  renderRecent();
  renderPurchase();
  renderOutfits();
  renderCategories();
}

function bindEvents(){
  document.querySelectorAll('[data-screen]').forEach(btn=>{
    btn.onclick=()=>navigate(btn.dataset.screen);
  });

  document.getElementById('settingsBtn').onclick=openDrawer;
  document.getElementById('closetGear').onclick=openDrawer;
  document.getElementById('closeDrawer').onclick=closeDrawer;

  document.getElementById('toggleAi').onclick=()=>{
    const box=document.getElementById('aiBox');
    box.classList.toggle('closed');
    document.getElementById('toggleAi').textContent=box.classList.contains('closed')?'⌄':'⌃';
  };

  document.getElementById('addCategory').onclick=addCategory;
  document.getElementById('drawerAddCategory').onclick=addCategory;
  document.getElementById('refreshCloud').onclick=loadCloud;
  document.getElementById('drawerRefresh').onclick=loadCloud;
  document.getElementById('saveOutfit').onclick=saveOutfit;
  document.getElementById('clearOutfit').onclick=clearOutfit;

  document.getElementById('addPurchase').onclick=()=>pick('purchase');
  document.getElementById('file-purchase').onchange=e=>{
    addPhotos('purchase',e.target.files);
    e.target.value='';
  };
}

async function start(){
  categories=loadCategories();
  bindEvents();
  renderAll();
  await loadCloud();
}

start();
