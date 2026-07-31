const PRODUCTS={
  classic:{name:'Classic Tempe Daun',price:3},
  fusion:{name:'Fusion Tempe Daun',price:6},
  'bundle-a':{name:'Bundle Best Seller A',price:20},
  'bundle-b':{name:'Bundle Best Seller B',price:20}
};
const BUSINESS_PHONE='601132099478';
const API_URL=window.TEMPETEN_API_URL||'';
let cart=JSON.parse(localStorage.getItem('tempeten_cart')||'{}');
let deliveryFee=0;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(n);
const persist=()=>localStorage.setItem('tempeten_cart',JSON.stringify(cart));
function allowedBatches(count=8){
  const result=[],today=new Date(); today.setHours(0,0,0,0);
  for(let i=4;result.length<count&&i<70;i++){
    const d=new Date(today); d.setDate(today.getDate()+i);
    if([1,5,6].includes(d.getDay())) result.push(d);
  }
  return result;
}
function dateLabel(d){return new Intl.DateTimeFormat('ms-MY',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d)}
function updateNextBatch(){const d=allowedBatches(1)[0]; $('#nextBatch').textContent=dateLabel(d)}
function qty(id){return cart[id]||0}
function subtotal(){return Object.entries(cart).reduce((sum,[id,q])=>sum+(PRODUCTS[id]?.price||0)*q,0)}
function totalQty(){return Object.values(cart).reduce((a,b)=>a+b,0)}
function setQty(id,value){cart[id]=Math.max(0,value);if(!cart[id])delete cart[id];persist();renderCart();renderProductQty()}
function renderProductQty(){$$('.product-card[data-product]').forEach(card=>{const id=card.dataset.product;if(PRODUCTS[id])card.querySelector('.qty').textContent=qty(id)})}
function renderCart(){
  $('#cartCount').textContent=totalQty(); $('#cartTotal').textContent=money(subtotal());
  const lines=Object.entries(cart).filter(([,q])=>q>0);
  $('#cartEmpty').hidden=lines.length>0; $('#cartItems').hidden=!lines.length; $('#checkoutBtn').disabled=!lines.length;
  $('#cartItems').innerHTML=lines.map(([id,q])=>`<div class="cart-line"><div><strong>${PRODUCTS[id].name}</strong><br><small>${money(PRODUCTS[id].price)} × ${q}</small></div><div><strong>${money(PRODUCTS[id].price*q)}</strong><div class="line-actions"><button data-cart-minus="${id}">−</button><span>${q}</span><button data-cart-plus="${id}">+</button></div></div></div>`).join('');
  $$('[data-cart-minus]').forEach(b=>b.onclick=()=>setQty(b.dataset.cartMinus,qty(b.dataset.cartMinus)-1));
  $$('[data-cart-plus]').forEach(b=>b.onclick=()=>setQty(b.dataset.cartPlus,qty(b.dataset.cartPlus)+1));
}
function openCart(){ $('#cartDrawer').classList.add('open');$('#cartDrawer').setAttribute('aria-hidden','false');$('#overlay').hidden=false;document.body.classList.add('no-scroll') }
function closeCart(){ $('#cartDrawer').classList.remove('open');$('#cartDrawer').setAttribute('aria-hidden','true');$('#overlay').hidden=true;document.body.classList.remove('no-scroll') }
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function fillBatchOptions(){ $('#batchSelect').innerHTML=allowedBatches().map(d=>`<option value="${d.toISOString().slice(0,10)}">${dateLabel(d)}</option>`).join('') }
function renderCheckout(){
  const lines=Object.entries(cart); $('#checkoutSummary').innerHTML=lines.map(([id,q])=>`<div class="summary-item"><span>${PRODUCTS[id].name} × ${q}</span><strong>${money(PRODUCTS[id].price*q)}</strong></div>`).join('');
  $('#checkoutSubtotal').textContent=money(subtotal()); $('#checkoutDelivery').textContent=money(deliveryFee); $('#checkoutGrand').textContent=money(subtotal()+deliveryFee)
}
function openCheckout(){closeCart();fillBatchOptions();deliveryFee=0;renderCheckout();$('#checkoutDialog').showModal()}
function estimatedDelivery(address){const a=address.toLowerCase();if(/putrajaya|cyberjaya/.test(a))return 12;if(/bangi|kajang/.test(a))return 24;if(/kuala lumpur|\bkl\b/.test(a))return 24;return 18}
async function quoteDelivery(){
  const address=$('[name="address"]').value.trim();if(!address){showToast('Masukkan alamat penghantaran dahulu');return}
  $('#quoteResult').textContent='Sedang semak kadar...';
  try{
    if(API_URL){const r=await fetch(`${API_URL}/api/delivery/quote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,batchDate:$('#batchSelect').value})});if(!r.ok)throw new Error('Quote gagal');const data=await r.json();deliveryFee=Number(data.amount||0);$('#quoteResult').textContent=`Kadar Lalamove: ${money(deliveryFee)}. Quotation sah sehingga ${data.expiresAt||'beberapa minit'}.`}
    else{deliveryFee=estimatedDelivery(address);$('#quoteResult').textContent=`Anggaran preview: ${money(deliveryFee)}. Kadar live akan disahkan melalui Lalamove API.`}
    renderCheckout();
  }catch(e){$('#quoteResult').textContent='Kadar live belum tersedia. Tempeten akan sahkan kadar melalui WhatsApp.'}
}
function makeOrderId(){return `TMP-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}
function whatsappMessage(order){
  const products=order.items.map(i=>`• ${i.name} x${i.qty} = ${money(i.total)}`).join('\n');
  return `Salam Tempeten. Saya baru buat pesanan melalui preview website.\n\nOrder: ${order.id}\nNama: ${order.customer.name}\nTelefon: ${order.customer.phone}\nBatch: ${order.batchDate}\nCara terima: ${order.fulfilment}\n${order.address?`Alamat: ${order.address}\n`:''}\n${products}\nDelivery: ${money(order.deliveryFee)}\nJumlah: ${money(order.total)}\n\nMohon semak dan sahkan pesanan ini. Terima kasih.`
}
async function submitOrder(e){
  e.preventDefault();const fd=new FormData(e.currentTarget);const fulfilment=fd.get('fulfilment');
  if(fulfilment==='lalamove'&&!fd.get('address')?.trim()){showToast('Alamat diperlukan untuk Lalamove');return}
  const order={id:makeOrderId(),createdAt:new Date().toISOString(),customer:{name:fd.get('name'),phone:fd.get('phone'),email:fd.get('email')},batchDate:fd.get('batchDate'),fulfilment,address:fd.get('address')||'',notes:fd.get('notes')||'',items:Object.entries(cart).map(([id,q])=>({id,name:PRODUCTS[id].name,qty:q,unitPrice:PRODUCTS[id].price,total:PRODUCTS[id].price*q})),subtotal:subtotal(),deliveryFee,total:subtotal()+deliveryFee,paymentStatus:'pending',orderStatus:'new'};
  $('#payBtn').disabled=true;$('#payBtn').textContent='Menyediakan pembayaran...';
  try{
    if(API_URL){const r=await fetch(`${API_URL}/api/orders`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(order)});if(!r.ok)throw new Error('Order gagal');const data=await r.json();location.href=data.paymentUrl;return}
    const orders=JSON.parse(localStorage.getItem('tempeten_orders')||'[]');orders.unshift(order);localStorage.setItem('tempeten_orders',JSON.stringify(orders));localStorage.setItem('tempeten_last_order',order.id);cart={};persist();renderCart();$('#checkoutDialog').close();window.open(`https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(whatsappMessage(order))}`,'_blank','noopener');location.href=`track.html?id=${encodeURIComponent(order.id)}`;
  }catch(err){showToast('Checkout belum dapat disambungkan. Cuba WhatsApp Tempeten.');window.open(`https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(whatsappMessage(order))}`,'_blank','noopener')}
  finally{$('#payBtn').disabled=false;$('#payBtn').textContent='Bayar dengan Billplz'}
}
$$('.qty-plus').forEach(b=>b.onclick=()=>{const id=b.closest('[data-product]').dataset.product;setQty(id,qty(id)+1);showToast(`${PRODUCTS[id].name} ditambah`)});
$$('.qty-minus').forEach(b=>b.onclick=()=>{const id=b.closest('[data-product]').dataset.product;setQty(id,qty(id)-1)});
$('#openCart').onclick=openCart;$('#ctaCart').onclick=openCart;$('#closeCart').onclick=closeCart;$('#overlay').onclick=closeCart;$('#checkoutBtn').onclick=openCheckout;$('#quoteDelivery').onclick=quoteDelivery;$('#checkoutForm').addEventListener('submit',submitOrder);
$$('[name="fulfilment"]').forEach(r=>r.onchange=()=>{const delivery=r.value==='lalamove'&&r.checked;$('#addressFields').hidden=!delivery;if(!delivery)deliveryFee=0;renderCheckout()});
updateNextBatch();renderProductQty();renderCart();
