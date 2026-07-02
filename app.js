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

const COLORS=[
  {id:'wit',label:'Wit',hex:'#ffffff'},
  {id:'zwart',label:'Zwart',hex:'#1f1f1f'},
  {id:'grijs',label:'Grijs',hex:'#9b9b9b'},
  {id:'beige',label:'Beige',hex:'#d8c4a7'},
  {id:'bruin',label:'Bruin',hex:'#8a5a35'},
  {id:'rood',label:'Rood',hex:'#c8463a'},
  {id:'roze',label:'Roze',hex:'#f0a6b6'},
  {id:'oranje',label:'Oranje',hex:'#e48a3a'},
  {id:'geel',label:'Geel',hex:'#f2cf4a'},
  {id:'groen',label:'Groen',hex:'#4e9b58'},
  {id:'blauw',label:'Blauw',hex:'#4f83bd'},
  {id:'paars',label:'Paars',hex:'#8f6bb3'},
  {id:'gemengd',label:'Gemengd',hex:'linear-gradient(135deg,#e57373,#ffd54f,#64b5f6)'}
];

const SEASONS=[
  {id:'lente',label:'Lente'},
  {id:'zomer',label:'Zomer'},
  {id:'herfst',label:'Herfst'},
  {id:'winter',label:'Winter'}
];

let categories=[];
let items=[];
let outfits=[];
let selected={tops:null,bottoms:null,shoes:null,bags:null};
let filters={};
let currentModalItem=null;
let modalColor='';
let modalSeason='';

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

function loadFilters(){
  try{
    const saved=localStorage.getItem('ecloset_filters_1');
    if(saved)return JSON.parse(saved);
  }catch(e){}
  return {};
}

function saveFilters(){
  localStorage.setItem('ecloset_filters_1',JSON.stringify(filters));
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

function detectColorFromFile(file){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        const size=120;
        canvas.width=size; canvas.height=size;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,size,size);
        const data=ctx.getImageData(0,0,size,size).data;
        const colors=[];
        for(let y=18;y<size-18;y+=3){
          for(let x=18;x<size-18;x+=3){
            const i=(y*size+x)*4;
            const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
            if(a<150)continue;
            const max=Math.max(r,g,b),min=Math.min(r,g,b);
            const sat=max-min,brightness=(r+g+b)/3;
            const weight=(brightness>225&&sat<25)?0.25:1;
            colors.push({r,g,b,weight});
          }
        }
        if(!colors.length){resolve('gemengd');return}
        let r=0,g=0,b=0,total=0;
        colors.forEach(c=>{r+=c.r*c.weight;g+=c.g*c.weight;b+=c.b*c.weight;total+=c.weight});
        resolve(colorName(Math.round(r/total),Math.round(g/total),Math.round(b/total)));
      };
      img.onerror=()=>resolve('gemengd');
      img.src=e.target.result;
    };
    reader.onerror=()=>resolve('gemengd');
    reader.readAsDataURL(file);
  });
}

function colorName(r,g,b){
  const max=Math.max(r,g,b),min=Math.min(r,g,b),diff=max-min,avg=(r+g+b)/3;
  if(avg<45)return 'zwart';
  if(avg>225&&diff<28)return 'wit';
  if(diff<22){
    if(avg<80)return 'zwart';
    if(avg>190)return 'wit';
    return 'grijs';
  }
  if(r>150&&g>125&&b>85&&r>=g&&g>=b&&diff<95){
    if(avg>170)return 'beige';
    return 'bruin';
  }
  if(r>95&&g>60&&b<70&&r>g&&g>=b)return 'bruin';
  if(r>190&&g>120&&b<80)return 'oranje';
  if(r>185&&g>165&&b<100)return 'geel';
  if(r>150&&g<120&&b<120)return 'rood';
  if(r>170&&b>135&&g<150)return 'roze';
  if(b>150&&r>100&&g<130)return 'paars';
  if(b>r+25&&b>g+15)return 'blauw';
  if(g>r+15&&g>b+10)return 'groen';
  return 'gemengd';
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
      const detectedColor=await detectColorFromFile(list[i]);
      const url=await uploadImage(list[i]);
      await api('/rest/v1/clothing',{
        method:'POST',
        headers:{'Content-Type':'application/json','Prefer':'return=representation'},
        body:JSON.stringify({
          category,
          name:'',
          image_url:url,
          brand:'',
          color:detectedColor,
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
    closePhotoModal();
    await loadCloud();
  }catch(e){
    console.error(e);
    alert('Verwijderen mislukt.');
  }
}

async function saveModalItem(){
  if(!currentModalItem)return;
  const name=document.getElementById('modalNameInput').value.trim();
  try{
    await api('/rest/v1/clothing?id=eq.'+currentModalItem.id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name,
        color:modalColor,
        season:modalSeason
      })
    });
    closePhotoModal();
    await loadCloud();
  }catch(e){
    console.error(e);
    alert('Opslaan mislukt.');
  }
}

function navigate(screen){
  closeDrawer();
  localStorage.setItem('ecloset_last_screen',screen);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screen).classList.add('active');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.screen===screen));
  window.scrollTo(0,0);
  renderAll();
  setTimeout(updateCenterCards,80);
}

function openDrawer(){document.getElementById('drawer').classList.add('open')}
function closeDrawer(){document.getElementById('drawer').classList.remove('open')}
function pick(category){document.getElementById('file-'+category)?.click()}

function itemsFor(category){
  let list=items.filter(item=>(item.category||'tops')===category);
  const f=filters[category]||{};
  if(f.color)list=list.filter(item=>(item.color||'')===f.color);
  if(f.season)list=list.filter(item=>(item.season||'')===f.season);
  return list;
}

function colorObj(id){
  return COLORS.find(c=>c.id===id) || COLORS.find(c=>c.id==='gemengd');
}

function colorDot(id,extra=''){
  const c=colorObj(id);
  const span=document.createElement('span');
  span.className='colorDot '+(id||'')+' '+extra;
  span.title=c.label;
  span.style.background=c.hex;
  return span;
}

function createCard(item,selectable=false,closet=false){
  const card=document.createElement('article');
  card.className='item';

  const img=document.createElement('img');
  img.src=item.image_url;
  img.onclick=()=>{
    if(selectable){
      selected[item.category]=item.id;
      const slot=document.getElementById('slot-'+item.category);
      if(slot)slot.innerHTML='<img src="'+item.image_url+'">';
      document.querySelectorAll('[data-row="'+item.category+'"] .item').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
    }else{
      openPhotoModal(item);
    }
  };
  card.appendChild(img);

  if(item.name){
    const name=document.createElement('div');
    name.className='itemName';
    name.textContent=item.name;
    card.appendChild(name);
  }

  const badges=document.createElement('div');
  badges.className='itemBadges';
  if(item.color)badges.appendChild(colorDot(item.color,'onCard'));
  if(item.season){
    const pill=document.createElement('span');
    pill.className='seasonPill';
    pill.textContent=SEASONS.find(s=>s.id===item.season)?.label || item.season;
    badges.appendChild(pill);
  }
  if(badges.children.length)card.appendChild(badges);

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
    empty.textContent='Geen foto’s voor deze filter';
    row.appendChild(empty);
  }else{
    list.forEach(item=>row.appendChild(createCard(item,selectable,closet)));
  }
  row.addEventListener('scroll',()=>requestAnimationFrame(updateCenterCards));
  return row;
}

function createFilterBar(category){
  const wrap=document.createElement('div');

  const colorTitle=document.createElement('div');
  colorTitle.className='filterGroupTitle';
  colorTitle.textContent='Filter op kleur';
  wrap.appendChild(colorTitle);

  const colorBar=document.createElement('div');
  colorBar.className='filterBar';
  const allColor=document.createElement('button');
  allColor.className='filterBtn '+(!(filters[category]||{}).color?'active':'');
  allColor.textContent='Alle kleuren';
  allColor.onclick=()=>{filters[category]={...(filters[category]||{}),color:''};saveFilters();renderAll()};
  colorBar.appendChild(allColor);

  COLORS.forEach(c=>{
    const b=document.createElement('button');
    b.className='filterBtn '+(((filters[category]||{}).color===c.id)?'active':'');
    b.appendChild(colorDot(c.id));
    b.append(' '+c.label);
    b.onclick=()=>{filters[category]={...(filters[category]||{}),color:c.id};saveFilters();renderAll()};
    colorBar.appendChild(b);
  });
  wrap.appendChild(colorBar);

  const seasonTitle=document.createElement('div');
  seasonTitle.className='filterGroupTitle';
  seasonTitle.textContent='Filter op seizoen';
  wrap.appendChild(seasonTitle);

  const seasonBar=document.createElement('div');
  seasonBar.className='filterBar';
  const allSeason=document.createElement('button');
  allSeason.className='filterBtn '+(!(filters[category]||{}).season?'active':'');
  allSeason.textContent='Alle seizoenen';
  allSeason.onclick=()=>{filters[category]={...(filters[category]||{}),season:''};saveFilters();renderAll()};
  seasonBar.appendChild(allSeason);

  SEASONS.forEach(s=>{
    const b=document.createElement('button');
    b.className='filterBtn '+(((filters[category]||{}).season===s.id)?'active':'');
    b.textContent=s.label;
    b.onclick=()=>{filters[category]={...(filters[category]||{}),season:s.id};saveFilters();renderAll()};
    seasonBar.appendChild(b);
  });
  wrap.appendChild(seasonBar);

  return wrap;
}

function renderStats(){
  const el=document.getElementById('stats');
  if(!el)return;
  el.innerHTML=
    '<div class="stat"><strong>'+items.length+'</strong><span>kledingstukken in cloud</span></div>'+
    '<div class="stat"><strong>'+categories.length+'</strong><span>categorieën</span></div>';
}

function renderCloset(){
  const container=document.getElementById('closetContent');
  if(!container)return;
  container.innerHTML='';

  categories.forEach(cat=>{
    const block=document.createElement('section');
    block.className='catBlock';

    const top=document.createElement('div');
    top.className='catTop';

    const left=document.createElement('div');
    left.innerHTML='<h2>'+cat.name+'</h2><div class="catCount">'+itemsFor(cat.id).length+' zichtbaar • '+items.filter(i=>(i.category||'tops')===cat.id).length+' totaal</div>';

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
    block.append(top,input,createFilterBar(cat.id),createRow(cat.id,false,true));
    container.appendChild(block);
  });
}

function renderBuilder(){
  const container=document.getElementById('builderContent');
  if(!container)return;
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
  if(!container)return;
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
      c.onclick=()=>openPhotoModal(item);
      container.appendChild(c);
    });
  }
}

function renderPurchase(){
  const c=document.getElementById('purchaseContent');
  if(!c)return;
  c.innerHTML='';
  const e=document.createElement('div');
  e.className='empty';
  e.textContent='Nieuwe aankoop volgt in de volgende stap';
  c.appendChild(e);
}

function renderOutfits(){
  const c=document.getElementById('savedOutfits');
  if(!c)return;
  c.innerHTML='';
  const e=document.createElement('div');
  e.className='empty';
  e.textContent='Nog geen outfits bewaard';
  c.appendChild(e);
}

function renderCategories(){
  const c=document.getElementById('categoryList');
  if(!c)return;
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

function openPhotoModal(item){
  currentModalItem=item;
  modalColor=item.color||'';
  modalSeason=item.season||'';

  document.getElementById('modalImg').src=item.image_url;
  document.getElementById('modalTitle').textContent=item.name||'Naamloos kledingstuk';
  document.getElementById('modalMeta').textContent='Pas kleur en seizoen zelf aan.';
  document.getElementById('modalNameInput').value=item.name||'';

  renderModalColorChoices();
  renderModalSeasonChoices();

  document.getElementById('photoModal').classList.add('open');
}

function renderModalColorChoices(){
  const c=document.getElementById('modalColorChoices');
  c.innerHTML='';
  COLORS.forEach(color=>{
    const b=document.createElement('button');
    b.className='colorChoice '+(modalColor===color.id?'active':'');
    b.appendChild(colorDot(color.id));
    b.append(' '+color.label);
    b.onclick=()=>{modalColor=color.id;renderModalColorChoices()};
    c.appendChild(b);
  });
}

function renderModalSeasonChoices(){
  const c=document.getElementById('modalSeasonChoices');
  c.innerHTML='';
  const none=document.createElement('button');
  none.className='seasonChoice '+(!modalSeason?'active':'');
  none.textContent='Geen';
  none.onclick=()=>{modalSeason='';renderModalSeasonChoices()};
  c.appendChild(none);
  SEASONS.forEach(season=>{
    const b=document.createElement('button');
    b.className='seasonChoice '+(modalSeason===season.id?'active':'');
    b.textContent=season.label;
    b.onclick=()=>{modalSeason=season.id;renderModalSeasonChoices()};
    c.appendChild(b);
  });
}

function closePhotoModal(){
  const modal=document.getElementById('photoModal');
  if(modal)modal.classList.remove('open');
  currentModalItem=null;
}

function updateCenterCards(){
  document.querySelectorAll('.row').forEach(row=>{
    const cards=[...row.querySelectorAll('.item')];
    if(!cards.length)return;
    const box=row.getBoundingClientRect();
    const center=box.left+box.width/2;
    let best=null,bestDist=Infinity;
    cards.forEach(card=>{
      const r=card.getBoundingClientRect();
      const c=r.left+r.width/2;
      const dist=Math.abs(center-c);
      if(dist<bestDist){bestDist=dist;best=card}
      card.classList.remove('center');
    });
    if(best)best.classList.add('center');
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
  const count=items.filter(i=>(i.category||'tops')===id).length;
  if(count>0){
    alert('Deze categorie bevat nog '+count+' foto(\\'s). Verwijder die eerst, zodat je niets per ongeluk kwijt bent.');
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
    const slot=document.getElementById('slot-'+id);
    if(slot)slot.textContent=label;
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
  setTimeout(updateCenterCards,80);
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

  const purchaseBtn=document.getElementById('addPurchase');
  const purchaseInput=document.getElementById('file-purchase');
  if(purchaseBtn)purchaseBtn.onclick=()=>pick('purchase');
  if(purchaseInput)purchaseInput.onchange=e=>{
    addPhotos('purchase',e.target.files);
    e.target.value='';
  };

  const closeModal=document.getElementById('closePhotoModal');
  if(closeModal)closeModal.onclick=closePhotoModal;
  const modal=document.getElementById('photoModal');
  if(modal)modal.onclick=e=>{if(e.target.id==='photoModal')closePhotoModal()};
  document.getElementById('modalSave').onclick=saveModalItem;
  document.getElementById('modalDelete').onclick=()=>{if(currentModalItem)deleteItem(currentModalItem.id)};

  document.addEventListener('scroll',()=>setTimeout(updateCenterCards,20),true);
}

async function start(){
  categories=loadCategories();
  filters=loadFilters();
  bindEvents();
  renderAll();
  await loadCloud();
  const last=localStorage.getItem('ecloset_last_screen')||'home';
  if(document.getElementById(last))navigate(last);
}

start();
