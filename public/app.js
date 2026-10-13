/* Ripple - vanilla JS single page app (hash routing) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let token = localStorage.getItem('rt');
let me = JSON.parse(localStorage.getItem('rme') || 'null');
let pendingFile = null;

/* ---------- theme ---------- */
const root = document.documentElement;
root.dataset.theme = localStorage.getItem('rtheme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/* ---------- icons ---------- */
const I = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z"/>',
  comment: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  out: '<path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* ---------- helpers ---------- */
async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && !url.includes('/auth/')) logout(true);
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 2800);
}
const hue = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;
const tx = (url, t) => url.replace('/upload/', `/upload/${t}/`);
function avatar(u, size = '') {
  if (u.avatar) return `<img class="av ${size}" src="${esc(tx(u.avatar, 'w_200,h_200,c_fill,g_auto,q_auto,f_auto'))}" alt="">`;
  return `<span class="av ${size}" style="--h:${hue(u.username)}" aria-hidden="true">${esc((u.name || u.username)[0].toUpperCase())}</span>`;
}
function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
const rich = t => esc(t)
  .replace(/(^|\s)#(\w{1,30})/g, '$1<span class="tag">#$2</span>')
  .replace(/(^|\s)@([a-z0-9_]{3,20})/gi, '$1<a class="tag" href="#/u/$2">@$2</a>');
const skeletons = n => '<div class="skel"></div>'.repeat(n);
const num = el => parseInt(el.textContent, 10) || 0;
const show = (el, n) => { el.textContent = n > 0 ? n : ''; };

/* ---------- image upload (direct to Cloudinary) ---------- */
function shrink(file, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => b ? res(b) : rej(new Error('Could not read that image')), 'image/jpeg', 0.85);
    };
    img.onerror = () => rej(new Error('That file is not a valid image'));
    img.src = URL.createObjectURL(file);
  });
}
async function uploadImage(file) {
  const sig = await api('/api/upload/sign');
  const fd = new FormData();
  fd.append('file', await shrink(file));
  fd.append('api_key', sig.apiKey); fd.append('timestamp', sig.timestamp);
  fd.append('folder', sig.folder); fd.append('signature', sig.signature);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || 'Photo upload failed');
  return d.secure_url;
}
function pickable(file) {
  if (!file) return false;
  if (!file.type.startsWith('image/')) { toast('Please choose an image file'); return false; }
  if (file.size > 12 * 1024 * 1024) { toast('That photo is too big (max 12 MB)'); return false; }
  return true;
}

/* ---------- auth screen ---------- */
function authFields(mode) {
  return mode === 'signup'
    ? `<label>Name<input name="name" autocomplete="name" required maxlength="40"></label>
       <label>Username<input name="username" autocomplete="username" required maxlength="20" placeholder="letters, numbers, _"></label>
       <label>Email<input name="email" type="email" autocomplete="email" required></label>
       <label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters"></label>`
    : `<label>Email or username<input name="identifier" autocomplete="username" required></label>
       <label>Password<input name="password" type="password" autocomplete="current-password" required></label>`;
}
function showAuth(mode = 'login') {
  const signup = mode === 'signup';
  $('#root').innerHTML = `
  <div class="auth">
    <section class="hero">
      <a class="brand" href="#/">ripple<i></i></a>
      <div>
        <h1>Say it once.<br>Let it travel.</h1>
        <p>Share moments, follow people you like and talk about what matters. Your corner of the internet, without the noise.</p>
      </div>
      <div class="mock" aria-hidden="true">
        <div class="mpost"><span class="av sm" style="--h:190">A</span><div><b>Ayesha</b> <span class="m">@ayesha · 2m</span><p>Sunrise walk on the trail today. Worth the early alarm.</p></div></div>
        <div class="mpost m2"><span class="av sm" style="--h:24">M</span><div><b>Musa</b> <span class="m">@musa · 9m</span><p>Shipped my first full stack app. #buildinpublic</p></div></div>
      </div>
    </section>
    <section class="formside">
      <form class="aform" id="authForm" data-mode="${mode}" novalidate>
        <h2>${signup ? 'Create your account' : 'Welcome back'}</h2>
        <p class="sub">${signup ? 'It takes less than a minute.' : 'Log in to see what your people are up to.'}</p>
        ${authFields(mode)}
        <p class="error" id="aerr" role="alert"></p>
        <button class="btn" id="asubmit">${signup ? 'Sign up' : 'Log in'}</button>
        <p class="aswitch">${signup ? 'Already on Ripple?' : 'New here?'} <button type="button" data-act="authmode" data-mode="${signup ? 'login' : 'signup'}">${signup ? 'Log in' : 'Create an account'}</button></p>
      </form>
    </section>
  </div>`;
}

/* ---------- app shell ---------- */
function shell() {
  const dark = root.dataset.theme === 'dark';
  $('#root').innerHTML = `
  <header class="topbar"><a class="brand" href="#/">ripple<i></i></a><div class="row"><button class="iconbtn" data-act="theme" aria-label="Toggle theme">${ic(dark ? 'sun' : 'moon')}</button><button class="iconbtn" data-act="logout" aria-label="Log out">${ic('out')}</button></div></header>
  <div class="shell">
    <aside class="side">
      <a class="brand" href="#/">ripple<i></i></a>
      <nav class="nav" aria-label="Main">
        <a href="#/" data-nav="home">${ic('home')}<span>Home</span></a>
        <a href="#/explore" data-nav="explore">${ic('explore')}<span>Explore</span></a>
        <a href="#/u/${me.username}" data-nav="me">${ic('user')}<span>Profile</span></a>
      </nav>
      <button class="btn" data-act="compose" aria-label="New post">${ic('plus')}<span>Post</span></button>
      <div class="side-foot">
        <button class="themebtn" data-act="theme">${ic(dark ? 'sun' : 'moon')}<span>${dark ? 'Light mode' : 'Dark mode'}</span></button>
        <div class="me-card card">${avatar(me)}<div class="who"><b>${esc(me.name)}</b><span>@${esc(me.username)}</span></div><button class="iconbtn" data-act="logout" aria-label="Log out" title="Log out">${ic('out')}</button></div>
      </div>
    </aside>
    <main id="main"></main>
    <aside class="rail" id="rail"></aside>
  </div>
  <nav class="tabbar" aria-label="Main">
    <a href="#/" data-nav="home" aria-label="Home">${ic('home')}</a>
    <a href="#/explore" data-nav="explore" aria-label="Explore">${ic('explore')}</a>
    <button class="go" data-act="compose" aria-label="New post">${ic('plus')}</button>
    <a href="#/u/${me.username}" data-nav="me" aria-label="Profile">${ic('user')}</a>
  </nav>`;
  renderRail();
}

/* ---------- rail: search + suggestions ---------- */
function searchBox(cls = '') {
  return `<div class="${cls}"><label class="search">${ic('search')}<input type="search" placeholder="Search people" autocomplete="off" aria-label="Search people" data-search><div class="sres" hidden></div></label></div>`;
}
function renderRail() {
  $('#rail').innerHTML = `<div class="card" style="padding:10px 12px">${searchBox()}</div>
    <div class="card"><h2>Who to follow</h2><div id="sugg">${skeletons(2)}</div></div>
    <p class="fine">Ripple · built with Node, Express and MongoDB</p>`;
  bindSearch($('[data-search]', $('#rail')));
  loadSuggestions();
}
function bindSearch(input) {
  const box = $('.sres', input.parentElement);
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (!q) { box.hidden = true; return; }
    t = setTimeout(async () => {
      try {
        const list = await api('/api/users/search?q=' + encodeURIComponent(q));
        box.innerHTML = list.length
          ? list.map(u => `<a class="urow" href="#/u/${esc(u.username)}">${avatar(u, 'sm')}<div class="meta"><b>${esc(u.name)}</b><span>@${esc(u.username)}</span></div></a>`).join('')
          : '<p class="muted-note" style="padding:10px">No one found</p>';
        box.hidden = false;
      } catch (e) { box.hidden = true; }
    }, 250);
  });
  input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 180));
  input.addEventListener('focus', () => { if (box.innerHTML && input.value.trim()) box.hidden = false; });
}
async function loadSuggestions() {
  const el = $('#sugg'); if (!el) return;
  try {
    const list = await api('/api/users/suggestions');
    el.innerHTML = list.length
      ? list.map(u => `<div class="urow"><a href="#/u/${esc(u.username)}" style="display:flex;gap:10px;align-items:center;flex:1;min-width:0">${avatar(u, 'sm')}<div class="meta"><b>${esc(u.name)}</b><span>@${esc(u.username)}</span></div></a><button class="btn sm" data-act="follow" data-user="${esc(u.username)}">Follow</button></div>`).join('')
      : '<p class="muted-note">You are following everyone for now. Check back soon.</p>';
  } catch (e) { el.innerHTML = '<p class="muted-note">Could not load suggestions</p>'; }
}

/* ---------- posts ---------- */
function postCard(p) {
  const mine = p.author.id === me.id, u = esc(p.author.username);
  return `<article class="post card" data-id="${p.id}" data-author="${p.author.id}">
    <a href="#/u/${u}" aria-label="${esc(p.author.name)}">${avatar(p.author)}</a>
    <div class="pbody">
      <header class="phead"><a href="#/u/${u}" class="pname">${esc(p.author.name)}</a><span class="pmeta">@${u} · <time datetime="${p.createdAt}" title="${esc(new Date(p.createdAt).toLocaleString())}">${ago(p.createdAt)}</time></span>
        ${mine ? `<button class="iconbtn sm del" data-act="del" aria-label="Delete post">${ic('trash')}</button>` : ''}</header>
      ${p.text ? `<p class="ptext">${rich(p.text)}</p>` : ''}
      ${p.image ? `<button class="pimg" data-act="zoom" data-src="${esc(tx(p.image, 'w_1600,c_limit,q_auto,f_auto'))}" aria-label="View photo"><img src="${esc(tx(p.image, 'w_900,c_limit,q_auto,f_auto'))}" alt="Photo shared by ${esc(p.author.name)}" loading="lazy"></button>` : ''}
      <footer class="pact">
        <button class="act like ${p.liked ? 'on' : ''}" data-act="like" aria-pressed="${p.liked}" aria-label="Like">${ic('heart')}<b>${p.likes || ''}</b></button>
        <button class="act" data-act="comments" aria-label="Comments">${ic('comment')}<b>${p.comments || ''}</b></button>
      </footer>
      <div class="pcom" hidden></div>
    </div></article>`;
}
function mountPosts(el, params, emptyHtml) {
  el.innerHTML = '<div class="plist"></div><div class="more"></div>';
  const list = $('.plist', el), more = $('.more', el);
  let next = null;
  list.innerHTML = skeletons(3);
  const load = async first => {
    try {
      const qs = new URLSearchParams(params);
      if (next) qs.set('before', next);
      const d = await api('/api/posts?' + qs);
      if (first) list.innerHTML = '';
      list.insertAdjacentHTML('beforeend', d.posts.map(postCard).join(''));
      next = d.next;
      if (first && !d.posts.length) list.innerHTML = `<div class="empty card">${emptyHtml}</div>`;
      more.innerHTML = next ? '<button class="btn ghost">Load more</button>' : '';
      const b = $('button', more);
      if (b) b.onclick = async () => { b.disabled = true; b.textContent = 'Loading...'; await load(false); };
    } catch (e) {
      if (first) list.innerHTML = `<div class="empty card"><h3>Could not load posts</h3>${esc(e.message)}</div>`;
      else toast(e.message);
    }
  };
  load(true);
}

async function toggleLike(btn) {
  const id = btn.closest('.post').dataset.id, c = $('b', btn);
  const was = btn.classList.contains('on');
  btn.classList.toggle('on', !was); btn.setAttribute('aria-pressed', String(!was));
  show(c, num(c) + (was ? -1 : 1));
  try {
    const d = await api(`/api/posts/${id}/like`, { method: 'POST' });
    btn.classList.toggle('on', d.liked); show(c, d.likes);
  } catch (e) {
    btn.classList.toggle('on', was); show(c, num(c) + (was ? 1 : -1)); toast(e.message);
  }
}
const commentHTML = (c, owner) => `<div class="cm" data-cid="${c.id}">${avatar(c.author, 'sm')}<div><b><a href="#/u/${esc(c.author.username)}">${esc(c.author.name)}</a></b> <span class="pmeta">${ago(c.createdAt)}</span><p>${rich(c.text)}</p></div>${(c.author.id === me.id || owner) ? `<button class="iconbtn sm" data-act="delcm" aria-label="Delete comment">${ic('x')}</button>` : ''}</div>`;

async function toggleComments(btn) {
  const post = btn.closest('.post'), box = $('.pcom', post);
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  if (box.dataset.loaded) return;
  box.innerHTML = '<p class="muted-note">Loading comments...</p>';
  try {
    const list = await api(`/api/posts/${post.dataset.id}/comments`);
    const owner = post.dataset.author === me.id;
    box.innerHTML = `<div class="clist">${list.map(c => commentHTML(c, owner)).join('')}</div>
      <form class="cform">${avatar(me, 'sm')}<input maxlength="200" placeholder="Write a comment" aria-label="Write a comment" required><button class="btn sm">Reply</button></form>`;
    box.dataset.loaded = '1';
    $('input', box).focus();
  } catch (e) { box.innerHTML = `<p class="muted-note">${esc(e.message)}</p>`; }
}

/* ---------- composer ---------- */
function composerHTML() {
  return `<form class="compose card" id="composer">
    ${avatar(me)}
    <div class="cbody">
      <textarea id="ctext" rows="2" maxlength="280" placeholder="What's on your mind, ${esc(me.name.split(' ')[0])}?" aria-label="Write a post"></textarea>
      <div class="cprev" id="cprev" hidden><img alt="Selected photo"><button type="button" class="x" data-act="rmimg" aria-label="Remove photo">${ic('x')}</button></div>
      <div class="cbar">
        <label class="iconbtn" title="Add a photo">${ic('image')}<input type="file" id="cfile" accept="image/*" hidden></label>
        <span class="count" id="ccount">280</span>
        <button class="btn" id="cpost" disabled>Post</button>
      </div>
    </div></form>`;
}
function refreshComposer() {
  const t = $('#ctext'); if (!t) return;
  t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 260) + 'px';
  const left = 280 - t.value.length;
  const c = $('#ccount'); c.textContent = left; c.classList.toggle('warn', left < 20);
  $('#cpost').disabled = !t.value.trim() && !pendingFile;
}
function clearComposer() {
  pendingFile = null; $('#ctext').value = ''; $('#cprev').hidden = true; $('#cfile').value = ''; refreshComposer();
}

/* ---------- views ---------- */
function feedView(kind) {
  const home = kind === 'following';
  $('#main').innerHTML = `
    <header class="page-head"><h1>${home ? 'Home' : 'Explore'}</h1><p>${home ? 'Posts from you and the people you follow' : 'See what everyone is sharing'}</p></header>
    ${home ? composerHTML() : searchBox('mob-search')}
    <section id="plist"></section>`;
  if (!home) bindSearch($('[data-search]', $('#main')));
  mountPosts($('#plist'), { feed: kind }, home
    ? '<h3>Your feed is quiet</h3>Write your first post, or follow a few people to fill it up.<br><a class="btn" href="#/explore">Find people</a>'
    : '<h3>Nothing here yet</h3>Be the first to post something.');
}

async function profileView(username) {
  $('#main').innerHTML = skeletons(3);
  try {
    const u = await api('/api/users/' + encodeURIComponent(username));
    const joined = new Date(u.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    $('#main').innerHTML = `
      <section class="profile card">
        <div class="banner" style="--h:${hue(u.username)}"></div>
        <div class="pinfo">
          <div class="prow">${avatar(u, 'xl')}
            ${u.isMe ? '<button class="btn ghost" data-act="edit">Edit profile</button>'
              : `<button class="btn ${u.isFollowing ? 'ghost' : ''}" data-act="follow" data-user="${esc(u.username)}" data-page="1">${u.isFollowing ? 'Following' : 'Follow'}</button>`}
          </div>
          <h1>${esc(u.name)}</h1>
          <p class="pmeta">@${esc(u.username)} · Joined ${joined}</p>
          ${u.bio ? `<p class="bio">${rich(u.bio)}</p>` : ''}
          <div class="stats"><span><b>${u.posts}</b> posts</span><span><b id="stFol">${u.followers}</b> followers</span><span><b>${u.following}</b> following</span></div>
        </div>
        <div class="tabs" role="tablist"><button class="on" role="tab" data-act="tab" data-tab="posts">Posts</button><button role="tab" data-act="tab" data-tab="likes">Likes</button></div>
      </section>
      <section id="plist" data-user="${esc(u.username)}"></section>`;
    mountPosts($('#plist'), { author: u.username }, u.isMe ? '<h3>No posts yet</h3>Share your first post from the Home page.' : '<h3>No posts yet</h3>When they post, you will see it here.');
  } catch (e) {
    $('#main').innerHTML = `<div class="empty card"><h3>${esc(e.message)}</h3><a class="btn" href="#/">Back home</a></div>`;
  }
}

function openEdit() {
  const d = $('#editDlg'); pendingFile = null;
  d.innerHTML = `<form class="dform" id="editForm">
    <h2>Edit profile</h2>
    <div class="avedit"><span id="eav">${avatar(me, 'xl')}</span><label class="btn ghost sm">Change photo<input type="file" id="efile" accept="image/*" hidden></label></div>
    <label>Name<input id="ename" maxlength="40" required value="${esc(me.name)}"></label>
    <label>Bio<textarea id="ebio" rows="3" maxlength="160" placeholder="Tell people a little about you">${esc(me.bio)}</textarea></label>
    <p class="error" id="eerr" role="alert"></p>
    <div class="drow"><button type="button" class="btn ghost" data-act="closedlg">Cancel</button><button class="btn" id="esave">Save</button></div>
  </form>`;
  d.showModal();
}

/* ---------- router ---------- */
function route() {
  if (!token || !me) { showAuth(); return; }
  if (!$('.shell')) shell();
  const h = location.hash || '#/';
  $$('[data-nav]').forEach(a => a.classList.toggle('on',
    (a.dataset.nav === 'home' && h === '#/') || (a.dataset.nav === 'explore' && h === '#/explore') || (a.dataset.nav === 'me' && h === '#/u/' + me.username)));
  window.scrollTo(0, 0);
  if (h.startsWith('#/u/')) profileView(decodeURIComponent(h.slice(4)));
  else if (h === '#/explore') feedView('explore');
  else feedView('following');
}
function logout(silent) {
  token = null; me = null; localStorage.removeItem('rt'); localStorage.removeItem('rme');
  if (!silent) toast('Logged out');
  history.replaceState(null, '', '#/'); showAuth();
}
window.addEventListener('hashchange', route);

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'like') return toggleLike(b);
  if (act === 'comments') return toggleComments(b);
  if (act === 'zoom') { $('#lightbox').innerHTML = `<img src="${b.dataset.src}" alt="Photo">`; return $('#lightbox').showModal(); }
  if (act === 'authmode') return showAuth(b.dataset.mode);
  if (act === 'logout') return logout();
  if (act === 'closedlg') return $('#editDlg').close();
  if (act === 'edit') return openEdit();
  if (act === 'theme') {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('rtheme', root.dataset.theme);
    const keep = location.hash; shell(); location.hash = keep; return route();
  }
  if (act === 'compose') {
    if (location.hash !== '' && location.hash !== '#/') location.hash = '#/';
    return setTimeout(() => { const t = $('#ctext'); if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 60);
  }
  if (act === 'rmimg') { pendingFile = null; $('#cprev').hidden = true; $('#cfile').value = ''; return refreshComposer(); }
  if (act === 'tab') {
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    const u = $('#plist').dataset.user;
    return mountPosts($('#plist'), b.dataset.tab === 'likes' ? { liked: u } : { author: u },
      b.dataset.tab === 'likes' ? '<h3>No likes yet</h3>Posts they like will show up here.' : '<h3>No posts yet</h3>');
  }
  if (act === 'del') {
    const post = b.closest('.post');
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try { await api('/api/posts/' + post.dataset.id, { method: 'DELETE' }); post.remove(); toast('Post deleted'); }
    catch (err) { toast(err.message); }
    return;
  }
  if (act === 'delcm') {
    const cm = b.closest('.cm'), post = b.closest('.post');
    try {
      await api(`/api/posts/${post.dataset.id}/comments/${cm.dataset.cid}`, { method: 'DELETE' });
      cm.remove(); const n = $('[data-act="comments"] b', post); show(n, num(n) - 1);
    } catch (err) { toast(err.message); }
    return;
  }
  if (act === 'follow') {
    b.disabled = true;
    try {
      const d = await api(`/api/users/${b.dataset.user}/follow`, { method: 'POST' });
      if (b.dataset.page) {
        b.textContent = d.following ? 'Following' : 'Follow'; b.classList.toggle('ghost', d.following);
        $('#stFol').textContent = d.followers;
      } else { toast('Following @' + b.dataset.user); loadSuggestions(); }
    } catch (err) { toast(err.message); }
    b.disabled = false;
  }
});

document.addEventListener('input', e => { if (e.target.id === 'ctext') refreshComposer(); });
document.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (e.target.id === 'cfile') {
    if (!pickable(f)) { e.target.value = ''; return; }
    pendingFile = f; const pv = $('#cprev'); $('img', pv).src = URL.createObjectURL(f); pv.hidden = false; refreshComposer();
  }
  if (e.target.id === 'efile') {
    if (!pickable(f)) { e.target.value = ''; return; }
    pendingFile = f; $('#eav').innerHTML = `<img class="av xl" src="${URL.createObjectURL(f)}" alt="">`;
  }
});
$('#lightbox').addEventListener('click', () => $('#lightbox').close());

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;

  if (f.id === 'authForm') {
    const btn = $('#asubmit'), mode = f.dataset.mode; btn.disabled = true; $('#aerr').textContent = '';
    try {
      const d = await api('/api/auth/' + (mode === 'signup' ? 'register' : 'login'), { method: 'POST', body: Object.fromEntries(new FormData(f)) });
      token = d.token; me = d.user; localStorage.setItem('rt', token); localStorage.setItem('rme', JSON.stringify(me));
      history.replaceState(null, '', '#/'); route(); toast(`Welcome, ${me.name.split(' ')[0]}`);
    } catch (err) { $('#aerr').textContent = err.message; btn.disabled = false; }
  }

  if (f.id === 'composer') {
    const btn = $('#cpost'), text = $('#ctext').value.trim(); btn.disabled = true; btn.textContent = pendingFile ? 'Uploading...' : 'Posting...';
    try {
      const image = pendingFile ? await uploadImage(pendingFile) : '';
      const p = await api('/api/posts', { method: 'POST', body: { text, image } });
      const list = $('#plist .plist');
      if (list) { $('.empty', list)?.remove(); list.insertAdjacentHTML('afterbegin', postCard(p).replace('class="post card"', 'class="post card fresh"')); }
      clearComposer(); toast('Posted');
    } catch (err) { toast(err.message); }
    btn.textContent = 'Post'; refreshComposer();
  }

  if (f.classList.contains('cform')) {
    const input = $('input', f), post = f.closest('.post'), text = input.value.trim(); if (!text) return;
    const btn = $('button', f); btn.disabled = true;
    try {
      const c = await api(`/api/posts/${post.dataset.id}/comments`, { method: 'POST', body: { text } });
      $('.clist', post).insertAdjacentHTML('beforeend', commentHTML(c, post.dataset.author === me.id));
      const n = $('[data-act="comments"] b', post); show(n, num(n) + 1); input.value = '';
    } catch (err) { toast(err.message); }
    btn.disabled = false; input.focus();
  }

  if (f.id === 'editForm') {
    const btn = $('#esave'); btn.disabled = true; btn.textContent = pendingFile ? 'Uploading...' : 'Saving...'; $('#eerr').textContent = '';
    try {
      const avatarUrl = pendingFile ? await uploadImage(pendingFile) : me.avatar;
      me = await api('/api/users/me', { method: 'PUT', body: { name: $('#ename').value, bio: $('#ebio').value, avatar: avatarUrl } });
      localStorage.setItem('rme', JSON.stringify(me)); pendingFile = null;
      $('#editDlg').close(); shell(); route(); toast('Profile updated');
    } catch (err) { $('#eerr').textContent = err.message; btn.disabled = false; btn.textContent = 'Save'; }
  }
});

/* ---------- boot ---------- */
(async function boot() {
  if (token) { try { me = await api('/api/auth/me'); localStorage.setItem('rme', JSON.stringify(me)); } catch (e) { if (!token) return route(); } }
  route();
})();
