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
  {id:'gemengd',label:'Gemengd',hex:'#c9b7df'}
];

const SEASONS=[
  {id:'lente',label:'🌸 Lente'},
  {id:'zomer',label:'☀️ Zomer'},
  {id:'herfst',label:'🍂 Herfst'},
  {id:'winter',label:'❄️ Winter'}
];

let categories=[];
let items=[];
let selected={tops:null,bottoms:null,shoes:null,bags:null};
let lockedOutfit={};
let colorFilters={};
let seasonFilters={};
let openFilterPanels={};
let currentModalItem=null;
let modalColorsList=[];
let modalSeason='';

function safeGet(id){return document.getElementById(id)}

function loadCategories(){
  const keys=['ecloset_categories_master','ecloset_categories_fix','ecloset_categories_1','ecloset_categories_v34'];
  for(const key of keys){
    try{
      const saved=localStorage.getItem(key);
      if(saved){
        const parsed=JSON.parse(saved);
        if(Array.isArray(parsed)&&parsed.length){
          localStorage.setItem('ecloset_categories_master',JSON.stringify(parsed));
          return parsed;
        }
      }
    }catch(e){}
  }
  return DEFAULT_CATEGORIES.map(c=>({...c}));
}

function saveCategories(){
  localStorage.setItem('ecloset_categories_master',JSON.stringify(categories));
}

function loadFilterState(){
  try{colorFilters=JSON.parse(localStorage.getItem('ecloset_color_filters')||'{}')}catch(e){colorFilters={}}
  try{seasonFilters=JSON.parse(localStorage.getItem('ecloset_season_filters')||'{}')}catch(e){seasonFilters={}}
}

function saveFilterState(){
  localStorage.setItem('ecloset_color_filters',JSON.stringify(colorFilters));
  localStorage.setItem('ecloset_season_filters',JSON.stringify(seasonFilters));
}

function setStatus(text,type=''){
  const el=safeGet('cloudStatus');
  if(el){
    el.textContent=text;
    el.className='cloud '+type;
  }
  updateHomeStat();
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
        w=Math.round(w*scale);
        h=Math.round(h*scale);
        const canvas=document.createElement('canvas');
        canvas.width=w;
        canvas.height=h;
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
        const size=100;
        canvas.width=size;
        canvas.height=size;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,size,size);
        const data=ctx.getImageData(0,0,size,size).data;
        let r=0,g=0,b=0,count=0;
        for(let y=20;y<size-20;y+=4){
          for(let x=20;x<size-20;x+=4){
            const i=(y*size+x)*4;
            r+=data[i];g+=data[i+1];b+=data[i+2];count++;
          }
        }
        if(!count){resolve('gemengd');return}
        resolve(colorName(Math.round(r/count),Math.round(g/count),Math.round(b/count)));
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
  if(avg>225&&diff<35)return 'wit';
  if(diff<25)return avg>170?'wit':avg<90?'zwart':'grijs';
  if(r>150&&g>125&&b>85&&r>=g&&g>=b&&diff<95)return avg>170?'beige':'bruin';
  if(r>150&&g<120&&b<120)return 'rood';
  if(r>170&&b>135&&g<150)return 'roze';
  if(r>190&&g>120&&b<90)return 'oranje';
  if(r>185&&g>165&&b<100)return 'geel';
  if(g>r+15&&g>b+10)return 'groen';
  if(b>r+25&&b>g+15)return 'blauw';
  if(b>150&&r>100&&g<140)return 'paars';
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
  
  const catBtn=document.getElementById('closetManageCategories');
  if(catBtn){
    catBtn.onclick=()=>navigate('settings');
  }

  await loadCloud();
}

function normalizeColors(value){
  if(Array.isArray(value))return value.filter(Boolean);
  if(!value)return [];
  return String(value).split(',').map(x=>x.trim()).filter(Boolean);
}

function colorString(list){
  return normalizeColors(list).join(',');
}

function colorHex(id){
  const c=COLORS.find(x=>x.id===id);
  return c?c.hex:'#c9b7df';
}

function seasonLabel(id){
  const s=SEASONS.find(x=>x.id===id);
  return s?s.label:id;
}

function itemsFor(category){
  let list=items.filter(item=>(item.category||'tops')===category);
  const color=colorFilters[category];
  const season=seasonFilters[category];
  if(color)list=list.filter(item=>normalizeColors(item.color).includes(color));
  if(season)list=list.filter(item=>(item.season||'')===season);
  return list;
}

function categoryName(id){
  const c=categories.find(x=>x.id===id);
  return c?c.name:id;
}

function toggleLockItem(item){
  const cat=item.category||'tops';
  if(lockedOutfit[cat] && String(lockedOutfit[cat].id)===String(item.id)){
    delete lockedOutfit[cat];
  }else{
    lockedOutfit[cat]=item;
  }
  renderAll();
}

function updateFloatingSave(){
  const btn=safeGet('floatingSaveOutfit');
  if(!btn)return;
  const count=Object.keys(lockedOutfit).length;
  btn.classList.toggle('hidden',count===0);
  btn.textContent=count?'Outfit bewaren ('+count+')':'Outfit bewaren';
}



function distanceRGB(a,b){
  const dr=a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2];
  return Math.sqrt(dr*dr+dg*dg+db*db);
}

function sampleBackgroundColor(ctx,w,h){
  const points=[
    [2,2],[w-3,2],[2,h-3],[w-3,h-3],
    [Math.floor(w/2),2],[Math.floor(w/2),h-3],[2,Math.floor(h/2)],[w-3,Math.floor(h/2)]
  ];
  let r=0,g=0,b=0,n=0;
  points.forEach(([x,y])=>{
    const d=ctx.getImageData(x,y,1,1).data;
    r+=d[0];g+=d[1];b+=d[2];n++;
  });
  return [r/n,g/n,b/n];
}

function removeBackgroundFromUrl(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      const max=900;
      let w=img.naturalWidth||img.width;
      let h=img.naturalHeight||img.height;
      const scale=Math.min(1,max/Math.max(w,h));
      w=Math.max(1,Math.round(w*scale));
      h=Math.max(1,Math.round(h*scale));

      const canvas=document.createElement('canvas');
      canvas.width=w;
      canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(img,0,0,w,h);

      const bg=sampleBackgroundColor(ctx,w,h);
      const image=ctx.getImageData(0,0,w,h);
      const data=image.data;

      // Eenvoudige test: pixels die sterk lijken op de randkleur worden transparant.
      // Dit is geen echte AI, maar goed genoeg om te testen of de flow werkt.
      for(let i=0;i<data.length;i+=4){
        const r=data[i], g=data[i+1], b=data[i+2];
        const dist=distanceRGB([r,g,b],bg);
        const brightness=(r+g+b)/3;
        const neutral=Math.max(r,g,b)-Math.min(r,g,b);

        if(dist<42 || (brightness>220 && neutral<38)){
          data[i+3]=0;
        }else if(dist<65){
          data[i+3]=Math.max(80,Math.round((dist-42)/23*255));
        }
      }

      ctx.putImageData(image,0,0);

      // Bijsnijden rond overblijvende pixels
      const out=ctx.getImageData(0,0,w,h).data;
      let minX=w,minY=h,maxX=0,maxY=0,found=false;
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          const a=out[(y*w+x)*4+3];
          if(a>20){
            found=true;
            if(x<minX)minX=x;
            if(y<minY)minY=y;
            if(x>maxX)maxX=x;
            if(y>maxY)maxY=y;
          }
        }
      }

      if(!found){
        resolve(url);
        return;
      }

      const pad=20;
      minX=Math.max(0,minX-pad);
      minY=Math.max(0,minY-pad);
      maxX=Math.min(w-1,maxX+pad);
      maxY=Math.min(h-1,maxY+pad);

      const cw=maxX-minX+1;
      const ch=maxY-minY+1;
      const crop=document.createElement('canvas');
      crop.width=cw;
      crop.height=ch;
      crop.getContext('2d').drawImage(canvas,minX,minY,cw,ch,0,0,cw,ch);
      resolve(crop.toDataURL('image/png'));
    };
    img.onerror=()=>reject(new Error('Afbeelding kon niet geladen worden'));
    img.src=url;
  });
}


function moodClassForCategory(cat,index){
  if(cat==='tops' || cat==='dresses' || cat==='jackets')return 'mainTop';
  if(cat==='bottoms')return 'mainBottom';
  if(cat==='shoes')return 'shoes';
  if(cat==='bags')return 'bag';
  return index % 2 === 0 ? 'extra1' : 'extra2';
}

function testMoodboard(){
  const board=document.getElementById('moodboardPreview');
  if(!board)return;

  const cards=[...document.querySelectorAll('.outfitPreviewCard')];
  if(!cards.length){
    alert('Geen outfit-items gevonden.');
    return;
  }

  board.innerHTML='';
  board.classList.remove('hidden');

  cards.forEach((card,index)=>{
    const img=card.querySelector('img');
    const cat=card.querySelector('b')?.textContent || '';
    if(!img)return;

    const item=document.createElement('div');
    item.className='moodItem '+moodClassForCategory(cat.toLowerCase(),index);

    const clone=document.createElement('img');
    clone.src=img.src;
    item.appendChild(clone);
    board.appendChild(item);
  });

  const title=document.createElement('div');
  title.className='moodTitle';
  title.textContent=(document.getElementById('outfitName')?.value || 'Mijn outfit');
  board.appendChild(title);

  board.scrollIntoView({behavior:'smooth',block:'nearest'});
}


async function testOutfitBackgrounds(){
  const status=document.getElementById('bgTestStatus');
  const selected=[...document.querySelectorAll('.outfitPreviewCard.selectedForBg')];
  const all=[...document.querySelectorAll('.outfitPreviewCard')];
  const cards=selected.length ? selected : all;

  if(!cards.length)return;

  if(status){
    status.textContent=selected.length
      ? 'Achtergrond opnieuw testen voor '+selected.length+' geselecteerd item(s)...'
      : 'Achtergrond testen voor alle items...';
  }

  let ok=0;
  for(const card of cards){
    const img=card.querySelector('img');
    if(!img)continue;
    try{
      card.classList.remove('bgProcessed');
      const processed=await removeBackgroundFromUrl(img.src);
      img.src=processed;
      card.classList.add('bgProcessed');
      card.classList.remove('selectedForBg');
      ok++;
    }catch(e){
      console.warn(e);
    }
  }

  if(status){
    status.textContent=ok
      ? 'Test klaar. Je kan slechte items opnieuw selecteren en nog eens testen.'
      : 'Test mislukt. Dan moeten we een sterkere methode gebruiken.';
  }
}


function openOutfitModal(){
  const locked=Object.entries(lockedOutfit||{});
  if(!locked.length){
    alert('Kies eerst minstens één kledingstuk.');
    return;
  }

  const preview=document.getElementById('outfitPreview');
  if(!preview)return;
  preview.innerHTML='';

  const preferred=['tops','bottoms','dresses','jackets','shoes','bags','accessories'];
  const ordered=[
    ...preferred.filter(cat=>lockedOutfit[cat]).map(cat=>[cat,lockedOutfit[cat]]),
    ...locked.filter(([cat])=>!preferred.includes(cat))
  ];

  ordered.forEach(([cat,item])=>{
    const card=document.createElement('div');
    card.className='outfitPreviewCard';
    card.innerHTML='<img src="'+item.image_url+'" alt=""><b>'+categoryName(cat)+'</b><span>'+(item.name||'Naamloos')+'</span><small class="bgTestSmall">Tik om te selecteren</small>';
    card.onclick=()=>card.classList.toggle('selectedForBg');
    preview.appendChild(card);
  });

  document.getElementById('outfitName').value='';
  document.getElementById('outfitNote').value='';
  const bgStatus=document.getElementById('bgTestStatus'); if(bgStatus)bgStatus.textContent='Tip: tik op één of meerdere items om alleen die opnieuw te testen.';
  const board=document.getElementById('moodboardPreview'); if(board){board.classList.add('hidden');board.innerHTML='';}
  document.getElementById('outfitModal').classList.add('open');
}

function closeOutfitModal(){
  const modal=document.getElementById('outfitModal');
  if(modal)modal.classList.remove('open');
}

function confirmSaveOutfit(){
  const locked=Object.values(lockedOutfit||{});
  if(!locked.length){
    closeOutfitModal();
    alert('Kies eerst minstens één kledingstuk.');
    return;
  }

  const name=(document.getElementById('outfitName')?.value||'').trim();
  const note=(document.getElementById('outfitNote')?.value||'').trim();
  const saved=JSON.parse(localStorage.getItem('ecloset_saved_outfits')||'[]');

  saved.push({
    id:Date.now(),
    date:new Date().toLocaleDateString('nl-BE'),
    name:name || 'Naamloze outfit',
    note,
    items:Object.fromEntries(Object.entries(lockedOutfit).map(([cat,item])=>[cat,item.id]))
  });

  localStorage.setItem('ecloset_saved_outfits',JSON.stringify(saved));
  window.savedOutfits=saved;
  closeOutfitModal();
  lockedOutfit={};
  alert('Outfit bewaard');
  renderAll();
}

function saveLockedOutfit(){
  openOutfitModal();
}

function createCard(item,selectable=false,closet=false,selectedOutfit=false){
  const card=document.createElement('article');
  card.className='item';
  if(selectedOutfit)card.classList.add('selectedForOutfit');
  
  card.dataset.itemId=item.id;

  const img=document.createElement('img');
  img.src=item.image_url;
  img.onclick=()=>{
    if(selectable){
      selected[item.category]=item.id;
      const slot=safeGet('slot-'+item.category);
      if(slot)slot.innerHTML='<img src="'+item.image_url+'">';
      document.querySelectorAll('[data-row="'+item.category+'"] .item').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
    }else{
      openPhotoModal(item);
    }
  };
  card.appendChild(img);

  if(closet){
    const lock=document.createElement('button');
    const cat=item.category||'tops';
    const isLocked=lockedOutfit[cat]&&String(lockedOutfit[cat].id)===String(item.id);
    lock.className='lockBtn '+(isLocked?'locked':'');
    lock.textContent=isLocked?'✓':'＋';
    lock.onclick=(event)=>{
      event.stopPropagation();
      toggleLockItem(item);
    };
    card.appendChild(lock);
  }

  if(item.name){
    const name=document.createElement('div');
    name.className='itemName';
    name.textContent=item.name;
    card.appendChild(name);
  }

  const badges=document.createElement('div');
  badges.className='itemBadges';

  normalizeColors(item.color).forEach(c=>{
    const dot=document.createElement('span');
    dot.className='itemDot';
    dot.style.background=colorHex(c);
    badges.appendChild(dot);
  });

  if(item.season){
    const season=document.createElement('span');
    season.className='seasonPill';
    season.textContent=seasonLabel(item.season);
    badges.appendChild(season);
  }

  if(item.favorite){
    const fav=document.createElement('span');
    fav.className='seasonPill';
    fav.textContent='⭐';
    badges.appendChild(fav);
  }

  if(badges.children.length)card.appendChild(badges);

  return card;
}

function createRow(category,selectable=false,closet=false){
  const row=document.createElement('div');
  const chosen=lockedOutfit[category];
  row.className='row '+(closet?'closetRow ':'')+(chosen?'lockedRow':'');
  row.dataset.row=category;

  let list=itemsFor(category);
  if(chosen){
    const chosenId=String(chosen.id);
    list=[chosen,...list.filter(item=>String(item.id)!==chosenId)];
  }

  if(!list.length){
    const e=document.createElement('div');
    e.className='empty';
    e.textContent='Nog geen foto’s';
    row.appendChild(e);
  }else{
    list.forEach(item=>{
      const isChosen=!!(chosen&&String(item.id)===String(chosen.id));
      row.appendChild(createCard(item,selectable,closet,isChosen));
    });
  }

  row.addEventListener('scroll',()=>requestAnimationFrame(updateCenterCards));
  return row;
}



function navigate(screen){
  localStorage.setItem('ecloset_last_screen',screen);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target=safeGet(screen);
  if(target)target.classList.add('active');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.screen===screen));
  window.scrollTo(0,0);
  renderAll();
}

function openDrawer(){}
function closeDrawer(){}
function pick(category){safeGet('file-'+category)?.click()}

function updateHomeStat(){
  const count=safeGet('homeItemCount');
  if(count)count.textContent=items.length;
  const outfits=safeGet('homeOutfitCount');
  if(outfits){
    const saved=JSON.parse(localStorage.getItem('ecloset_saved_outfits')||'[]');
    outfits.textContent=saved.length;
  }
}

function firstImageFor(category){
  const item=items.find(x=>(x.category||'tops')===category);
  return item?item.image_url:'';
}

function updateHomeTilePhotos(){
  const closet=document.getElementById('tilePhoto-closet');
  const outfitsTile=document.getElementById('tilePhoto-outfits');
  const logbook=document.getElementById('tilePhoto-logbook');
  const purchase=document.getElementById('tilePhoto-purchase');

  const saved=JSON.parse(localStorage.getItem('ecloset_saved_outfits')||'[]');
  const firstItem=items[0]?.image_url || '';
  const wishlistItem=items.find(x=>(x.category||'')==='purchase')?.image_url || '';

  if(document.getElementById('tileInfo-closet')){
    document.getElementById('tileInfo-closet').textContent=items.length+' kledingstukken';
  }
  if(document.getElementById('tileInfo-outfits')){
    document.getElementById('tileInfo-outfits').textContent=saved.length+' outfits bewaard';
  }
  if(document.getElementById('tileInfo-logbook')){
    document.getElementById('tileInfo-logbook').textContent='Binnenkort: kalender en statistieken';
  }
  if(document.getElementById('tileInfo-purchase')){
    document.getElementById('tileInfo-purchase').textContent=wishlistItem?'1 item op je wishlist':'Nog geen wishlist-items';
  }

  // Mijn kast: eerste kledingstuk uit kast
  if(closet && firstItem){
    closet.style.backgroundImage='url("'+firstItem+'")';
    closet.classList.add('hasOwnPhoto');
  }

  // Outfits: eerste item uit laatst bewaarde outfit als preview
  if(outfitsTile && saved.length){
    const last=saved[saved.length-1];
    const firstId=Object.values(last.items||{})[0];
    const item=items.find(x=>String(x.id)===String(firstId));
    if(item){
      outfitsTile.style.backgroundImage='url("'+item.image_url+'")';
      outfitsTile.classList.add('hasOwnPhoto');
    }
  }else if(outfitsTile && firstItem){
    outfitsTile.style.backgroundImage='url("'+firstItem+'")';
    outfitsTile.classList.add('hasOwnPhoto');
  }

  // Logboek: later laatst gedragen, voorlopig eerste kledingstuk
  if(logbook && firstItem){
    logbook.style.backgroundImage='url("'+firstItem+'")';
    logbook.classList.add('hasOwnPhoto');
  }

  // Wishlist: later twijfels, voorlopig wishlist/purchase of fallback
  if(purchase && (wishlistItem||firstItem)){
    purchase.style.backgroundImage='url("'+(wishlistItem||firstItem)+'")';
    purchase.classList.add('hasOwnPhoto');
  }
}

function renderStats(){
  const summary=safeGet('closetSummary');
  if(summary)summary.textContent=items.length+' kledingstukken • '+categories.length+' categorieën';
}


function createFilterPanel(category){
  const wrap=document.createElement('div');
  wrap.className='filterPanel '+(openFilterPanels[category]?'open':'');
  wrap.id='filter-'+category;

  const colorTitle=document.createElement('div');
  colorTitle.className='filterTitle';
  colorTitle.textContent='Filter op kleur';
  wrap.appendChild(colorTitle);

  const colorBar=document.createElement('div');
  colorBar.className='filterBar';

  const allColors=document.createElement('button');
  allColors.className='filterBtn '+(!colorFilters[category]?'active':'');
  allColors.textContent='Alle kleuren';
  allColors.onclick=()=>{
    colorFilters[category]='';
    saveFilterState();
    renderAll();
  };
  colorBar.appendChild(allColors);

  COLORS.forEach(color=>{
    const b=document.createElement('button');
    b.className='filterBtn '+(colorFilters[category]===color.id?'active':'');
    const dot=document.createElement('span');
    dot.className='colorDot';
    dot.style.background=color.hex;
    b.appendChild(dot);
    b.append(color.label);
    b.onclick=()=>{
      colorFilters[category]=color.id;
      saveFilterState();
      renderAll();
    };
    colorBar.appendChild(b);
  });
  wrap.appendChild(colorBar);

  const seasonTitle=document.createElement('div');
  seasonTitle.className='filterTitle';
  seasonTitle.textContent='Filter op seizoen';
  wrap.appendChild(seasonTitle);

  const seasonBar=document.createElement('div');
  seasonBar.className='filterBar';

  const allSeasons=document.createElement('button');
  allSeasons.className='filterBtn '+(!seasonFilters[category]?'active':'');
  allSeasons.textContent='Alle seizoenen';
  allSeasons.onclick=()=>{
    seasonFilters[category]='';
    saveFilterState();
    renderAll();
  };
  seasonBar.appendChild(allSeasons);

  SEASONS.forEach(season=>{
    const b=document.createElement('button');
    b.className='filterBtn '+(seasonFilters[category]===season.id?'active':'');
    b.textContent=season.label;
    b.onclick=()=>{
      seasonFilters[category]=season.id;
      saveFilterState();
      renderAll();
    };
    seasonBar.appendChild(b);
  });
  wrap.appendChild(seasonBar);

  return wrap;
}

function renderCloset(){
  const container=safeGet('closetContent');
  if(!container)return;
  container.innerHTML='';

  categories.forEach(cat=>{
    const block=document.createElement('section');
    block.className='catBlock';

    const top=document.createElement('div');
    top.className='catTop';

    const left=document.createElement('div');
    left.innerHTML='<h2>'+cat.name+'</h2><div class="catCount">'+itemsFor(cat.id).length+' stuk(s)</div>';

    const actions=document.createElement('div');
    actions.className='catActionsTop';

    const filterBtn=document.createElement('button');
    filterBtn.className='filterToggle';
    filterBtn.textContent=(colorFilters[cat.id]||seasonFilters[cat.id])?'Filter actief':'Filter';
    filterBtn.onclick=()=>{
      openFilterPanels[cat.id]=!openFilterPanels[cat.id];
      renderAll();
    };

    const btn=document.createElement('button');
    btn.textContent='Foto toevoegen';
    btn.onclick=()=>pick(cat.id);

    actions.append(filterBtn,btn);

    const input=document.createElement('input');
    input.type='file';
    input.accept='image/*';
    input.multiple=true;
    input.id='file-'+cat.id;
    input.onchange=e=>{
      addPhotos(cat.id,e.target.files);
      e.target.value='';
    };

    top.append(left,actions);
    block.append(top,input,createFilterPanel(cat.id),createRow(cat.id,false,true));
    container.appendChild(block);
  });
}

function renderBuilder(){
  const container=safeGet('builderContent');
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
  const container=safeGet('recent');
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
      const card=createCard(item,false,false);
      card.classList.add('active');
      container.appendChild(card);
    });
  }
}

function renderPurchase(){
  const c=safeGet('purchaseContent');
  if(!c)return;
  c.innerHTML='';
  const e=document.createElement('div');
  e.className='empty';
  e.textContent='Nieuwe aankoop volgt later';
  c.appendChild(e);
}

function renderOutfits(){
  const c=(typeof safeGet==='function') ? safeGet('savedOutfits') : document.getElementById('savedOutfits');
  if(!c)return;
  c.innerHTML='';
  const saved=JSON.parse(localStorage.getItem('ecloset_saved_outfits')||'[]');
  window.savedOutfits=saved;
  if(!saved.length){
    const e=document.createElement('div');
    e.className='empty';
    e.textContent='Nog geen outfits bewaard';
    c.appendChild(e);
    return;
  }
  saved.slice().reverse().forEach((outfit,index)=>{
    const panel=document.createElement('div');
    panel.className='panel';
    panel.innerHTML='<h2>'+(outfit.name||('Outfit '+(saved.length-index)))+'</h2><p>'+(outfit.note?outfit.note+' • ':'')+'Bewaard op '+outfit.date+'</p>';
    const row=document.createElement('div');
    row.className='row compact';
    Object.values(outfit.items||{}).forEach(id=>{
      const item=items.find(x=>String(x.id)===String(id));
      if(item){
        const card=createCard(item,false,false);
        card.classList.add('active');
        row.appendChild(card);
      }
    });
    panel.appendChild(row);
    c.appendChild(panel);
  });
}

function renderCategories(){
  const c=safeGet('categoryList');
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
  modalColorsList=normalizeColors(item.color);
  modalSeason=item.season||'';

  safeGet('modalImg').src=item.image_url;
  safeGet('modalTitle').textContent=item.name||'Naamloos kledingstuk';
  safeGet('modalName').value=item.name||'';
  safeGet('modalFav').checked=!!item.favorite;

  renderModalColors();
  renderModalSeasons();
  safeGet('photoModal')?.classList.add('open');
}

function closePhotoModal(){
  safeGet('photoModal')?.classList.remove('open');
  currentModalItem=null;
}

function renderModalColors(){
  const box=safeGet('modalColors');
  if(!box)return;
  box.innerHTML='';
  COLORS.forEach(color=>{
    const b=document.createElement('button');
    const active=modalColorsList.includes(color.id);
    b.className='colorChoice '+(active?'multiActive active':'');
    const dot=document.createElement('span');
    dot.className='colorDot';
    dot.style.background=color.hex;
    b.appendChild(dot);
    b.append(color.label);
    b.onclick=()=>{
      if(modalColorsList.includes(color.id)){
        modalColorsList=modalColorsList.filter(x=>x!==color.id);
      }else{
        modalColorsList.push(color.id);
      }
      renderModalColors();
    };
    box.appendChild(b);
  });
}

function renderModalSeasons(){
  const box=safeGet('modalSeasons');
  if(!box)return;
  box.innerHTML='';
  const none=document.createElement('button');
  none.className='seasonChoice '+(!modalSeason?'active':'');
  none.textContent='Geen';
  none.onclick=()=>{modalSeason='';renderModalSeasons()};
  box.appendChild(none);

  SEASONS.forEach(season=>{
    const b=document.createElement('button');
    b.className='seasonChoice '+(modalSeason===season.id?'active':'');
    b.textContent=season.label;
    b.onclick=()=>{modalSeason=season.id;renderModalSeasons()};
    box.appendChild(b);
  });
}

function showSavedHint(){
  const old=document.querySelector('.savedHint');
  if(old)old.remove();
  const div=document.createElement('div');
  div.className='savedHint';
  div.textContent='Opgeslagen';
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),1100);
}

async function saveModalItem(){
  if(!currentModalItem)return;
  const id=currentModalItem.id;
  const name=(safeGet('modalName')?.value||'').trim();
  const favorite=!!safeGet('modalFav')?.checked;
  const newColor=colorString(modalColorsList);
  const newSeason=modalSeason;

  try{
    await api('/rest/v1/clothing?id=eq.'+id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,color:newColor,season:newSeason,favorite})
    });

    const item=items.find(x=>String(x.id)===String(id));
    if(item)Object.assign(item,{name,color:newColor,season:newSeason,favorite});
    currentModalItem=item||currentModalItem;
    safeGet('modalTitle').textContent=name||'Naamloos kledingstuk';
    showSavedHint();
    renderAll();
    safeGet('photoModal')?.classList.add('open');
  }catch(e){
    console.error(e);
    alert('Opslaan mislukt.');
  }
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

function addCategory(){
  const name=prompt('Naam van nieuwe categorie?');
  if(!name)return;
  const colors=['#d9ecff','#dcf4e6','#ffe1e9','#fff0c9','#eadfff','#f1dfd2'];
  categories.push({id:'cat_'+Date.now(),name,color:colors[categories.length%colors.length]});
  saveCategories();
  renderAll();
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
    alert("Deze categorie bevat nog "+count+" foto(s). Verwijder die eerst.");
    return;
  }
  if(!confirm('Categorie "'+cat.name+'" verwijderen?'))return;
  categories=categories.filter(c=>c.id!==id);
  saveCategories();
  renderAll();
}

function saveOutfit(){
  alert('Gebruik het plusje op kledingstukken in Mijn kast om outfits vast te zetten.');
}

function clearOutfit(){
  selected={tops:null,bottoms:null,shoes:null,bags:null};
  Object.entries({tops:'Top',bottoms:'Onderstuk',shoes:'Schoenen',bags:'Tas'}).forEach(([id,label])=>{
    const slot=safeGet('slot-'+id);
    if(slot)slot.textContent=label;
  });
}

function updateCenterCards(){
  document.querySelectorAll('.row').forEach(row=>{
    const cards=[...row.querySelectorAll('.item')];
    if(!cards.length)return;
    const box=row.getBoundingClientRect();
    const center=box.left+box.width/2;
    let best=null,bestDist=Infinity;
    cards.forEach(card=>{
      if(card.classList.contains('pinnedItem'))return;
      if(card.classList.contains('selectedForOutfit'))return;
      const r=card.getBoundingClientRect();
      const c=r.left+r.width/2;
      const dist=Math.abs(center-c);
      if(dist<bestDist){bestDist=dist;best=card}
      card.classList.remove('center');
    });
    if(best)best.classList.add('center');
  });
}


function fixCategoryButton(){
  const btn=document.getElementById('closetManageCategories');
  if(btn){
    btn.textContent='Categorieën aanpassen';
    btn.classList.add('closetManageBtn');
    btn.onclick=()=>navigate('settings');
  }
}

function renderAll(){
  updateHomeStat();
  updateHomeTilePhotos();
  renderStats();
  renderCloset();
  renderBuilder();
  renderRecent();
  renderPurchase();
  renderOutfits();
  renderCategories();
  fixCategoryButton();
  updateFloatingSave();
  setTimeout(updateCenterCards,80);
}

function bindEvents(){
  document.querySelectorAll('[data-screen]').forEach(btn=>{
    btn.onclick=()=>navigate(btn.dataset.screen);
  });

  if(safeGet('settingsBtn'))safeGet('settingsBtn').onclick=()=>{};
  if(safeGet('toggleAi'))safeGet('toggleAi').onclick=()=>{
    const box=safeGet('aiBox');
    if(!box)return;
    box.classList.toggle('closed');
    safeGet('toggleAi').textContent=box.classList.contains('closed')?'⌄':'⌃';
  };

  if(safeGet('addCategory'))safeGet('addCategory').onclick=addCategory;
  if(safeGet('drawerAddCategory'))safeGet('drawerAddCategory').onclick=addCategory;
  if(safeGet('refreshCloud'))safeGet('refreshCloud').onclick=loadCloud;
  if(safeGet('drawerRefresh'))safeGet('drawerRefresh').onclick=loadCloud;
  if(safeGet('saveOutfit'))safeGet('saveOutfit').onclick=saveOutfit;
  if(safeGet('clearOutfit'))safeGet('clearOutfit').onclick=clearOutfit;
  if(safeGet('closetManageCategories'))safeGet('closetManageCategories').onclick=()=>navigate('settings');
  if(safeGet('floatingSaveOutfit'))safeGet('floatingSaveOutfit').onclick=saveLockedOutfit;

  if(safeGet('addPurchase'))safeGet('addPurchase').onclick=()=>pick('purchase');
  if(safeGet('file-purchase'))safeGet('file-purchase').onchange=e=>{
    addPhotos('purchase',e.target.files);
    e.target.value='';
  };

  if(safeGet('closePhotoModal'))safeGet('closePhotoModal').onclick=closePhotoModal;
  if(safeGet('photoModal'))safeGet('photoModal').onclick=e=>{
    if(e.target.id==='photoModal')closePhotoModal();
  };
  if(safeGet('modalSave'))safeGet('modalSave').onclick=saveModalItem;
  if(safeGet('modalDelete'))safeGet('modalDelete').onclick=()=>{
    if(currentModalItem)deleteItem(currentModalItem.id);
  };

  if(safeGet('closeOutfitModal'))safeGet('closeOutfitModal').onclick=closeOutfitModal;
  if(safeGet('cancelOutfitModal'))safeGet('cancelOutfitModal').onclick=closeOutfitModal;
  if(safeGet('confirmSaveOutfit'))safeGet('confirmSaveOutfit').onclick=confirmSaveOutfit;
  if(safeGet('testOutfitBackgrounds'))safeGet('testOutfitBackgrounds').onclick=testOutfitBackgrounds;
  if(safeGet('testMoodboard'))safeGet('testMoodboard').onclick=testMoodboard;
  const outfitModal=document.getElementById('outfitModal');
  if(outfitModal)outfitModal.onclick=e=>{if(e.target.id==='outfitModal')closeOutfitModal()};
}

async function start(){
  categories=loadCategories();
  loadFilterState();
  window.savedOutfits=JSON.parse(localStorage.getItem('ecloset_saved_outfits')||'[]');
  bindEvents();
  renderAll();
  await loadCloud();
  const last=localStorage.getItem('ecloset_last_screen')||'home';
  fixCategoryButton();
  if(safeGet(last))navigate(last);
}

start();
