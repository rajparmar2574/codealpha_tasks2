/* ═══════════════════════════════════════════════════════════
   SOCIALSPARK — Complete Frontend App
   Connects to Django REST API on http://localhost:8000
═══════════════════════════════════════════════════════════ */

const API = 'http://localhost:8000/api';

let currentUser  = null;
let currentToken = null;
let activeFeed   = 'all';
let activeCommentPostId = null;
let followersModalMode  = 'followers'; // 'followers' | 'following'
let followersModalUser  = null;
let searchDebounce = null;
let postImageFile  = null;
let notifPollTimer = null;

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  currentToken = localStorage.getItem('ss_token');
  if (currentToken) {
    loadCurrentUser();
  }

  // textarea char counter
  const ta = document.getElementById('post-content');
  if (ta) ta.addEventListener('input', () => {
    document.getElementById('char-used').textContent = ta.value.length;
  });
});

/* ══════════════════════════════════════════════════════════
   API HELPER
══════════════════════════════════════════════════════════ */
async function apiFetch(path, opts = {}) {
  const headers = { ...opts.headers };
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

/* ══════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════ */
function switchAuth(mode) {
  document.getElementById('login-form').classList.toggle('active', mode === 'login');
  document.getElementById('register-form').classList.toggle('active', mode === 'register');
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  try {
    const data = await apiFetch('/auth/login/', {
      method: 'POST', body: JSON.stringify({ username, password })
    });
    setAuth(data);
  } catch (e) {
    errEl.textContent = e.error || 'Login failed. Check your credentials.';
  }
}

async function register() {
  const first_name = document.getElementById('reg-firstname').value.trim();
  const last_name  = document.getElementById('reg-lastname').value.trim();
  const username   = document.getElementById('reg-username').value.trim();
  const email      = document.getElementById('reg-email').value.trim();
  const password   = document.getElementById('reg-password').value;
  const password2  = document.getElementById('reg-password2').value;
  const errEl      = document.getElementById('reg-error');
  errEl.textContent = '';

  if (!username || !password || !password2) {
    errEl.textContent = 'Username and passwords are required.'; return;
  }
  if (password !== password2) {
    errEl.textContent = 'Passwords do not match.'; return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.'; return;
  }
  try {
    const data = await apiFetch('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, email, first_name, last_name, password, password2 })
    });
    setAuth(data);
  } catch (e) {
    const msgs = Object.values(e).flat().join(' ');
    errEl.textContent = msgs || 'Registration failed. Try a different username.';
  }
}

function setAuth({ access, user }) {
  currentToken = access;
  currentUser  = user;
  localStorage.setItem('ss_token', access);
  showApp();
}

async function loadCurrentUser() {
  try {
    currentUser = await apiFetch('/me/');
    showApp();
  } catch {
    logout();
  }
}

function logout() {
  clearInterval(notifPollTimer);
  currentToken = null;
  currentUser  = null;
  localStorage.removeItem('ss_token');
  document.getElementById('auth-overlay').style.display = 'grid';
  document.getElementById('app').classList.add('hidden');
}

/* ══════════════════════════════════════════════════════════
   SHOW APP
══════════════════════════════════════════════════════════ */
function showApp() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  updateSidebarUser();
  showPage('feed');
  loadSuggestions();
  pollNotifications();
  notifPollTimer = setInterval(pollNotifications, 30000);
}

function updateSidebarUser() {
  if (!currentUser) return;
  const name = fullName(currentUser);
  document.getElementById('sidebar-name').textContent  = name;
  document.getElementById('sidebar-handle').textContent = '@' + currentUser.username;
  renderAvatarInEl('sidebar-avatar', currentUser);
  renderAvatarInEl('create-avatar',  currentUser);
  renderAvatarInEl('comment-avatar', currentUser);

  const modalName   = document.getElementById('modal-name');
  const modalHandle = document.getElementById('modal-handle');
  if (modalName)   modalName.textContent   = name;
  if (modalHandle) modalHandle.textContent = '@' + currentUser.username;
  renderAvatarInEl('modal-avatar', currentUser);
}

/* ══════════════════════════════════════════════════════════
   AVATAR HELPERS
══════════════════════════════════════════════════════════ */
function fullName(user) {
  return ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || user.username;
}

function initials(user) {
  const fn = user.first_name?.[0] || '';
  const ln = user.last_name?.[0]  || '';
  return (fn + ln).toUpperCase() || user.username?.[0]?.toUpperCase() || '?';
}

function renderAvatarInEl(elId, user) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (user?.profile?.avatar) {
    el.innerHTML = `<img src="${user.profile.avatar}" alt="${esc(user.username)}" />`;
  } else {
    el.textContent = initials(user);
  }
}

function avatarDiv(user, cssClass = 'post-avatar', onclick = '') {
  const avatar   = user?.profile?.avatar;
  const init     = initials(user);
  const clickStr = onclick ? `onclick="${onclick}"` : '';
  if (avatar) {
    return `<div class="${cssClass}" ${clickStr}><img src="${avatar}" alt="${esc(user.username)}" /></div>`;
  }
  return `<div class="${cssClass}" ${clickStr}>${init}</div>`;
}

/* ══════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${name}"]`)?.classList.add('active');

  if (name === 'feed')          loadPosts();
  else if (name === 'explore')  loadUsers('');
  else if (name === 'notifications') loadNotifications();
  else if (name === 'profile')  viewProfile(currentUser?.username);
}

/* ══════════════════════════════════════════════════════════
   POSTS — FEED
══════════════════════════════════════════════════════════ */
async function loadPosts() {
  const container = document.getElementById('posts-container');
  container.innerHTML = '<div class="loading-spinner">Loading posts…</div>';
  const qs = activeFeed === 'following' ? '?feed=true' : '';
  try {
    const posts = await apiFetch(`/posts/${qs}`);
    renderPosts(posts, container);
  } catch {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">⚠️</span>
      <h4>Could not load posts</h4>
      <p>Make sure the Django server is running on port 8000.</p>
    </div>`;
  }
}

function renderPosts(posts, container) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">✦</span>
      <h4>Nothing here yet</h4>
      <p>Be the first to post, or follow some people!</p>
    </div>`;
    return;
  }
  container.innerHTML = '';
  posts.forEach(post => container.appendChild(buildPostEl(post)));
}

function buildPostEl(post) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.id = `post-${post.id}`;
  el.innerHTML = buildPostHTML(post);
  return el;
}

function buildPostHTML(post) {
  const isOwner    = currentUser && post.author === currentUser.id;
  const authorName = post.author_name || post.author_username;
  const likedClass = post.is_liked ? 'liked' : '';
  const time       = timeAgo(post.created_at);
  const img        = post.image ? `<img class="post-image" src="${post.image}" alt="post" loading="lazy" />` : '';
  const delBtn     = isOwner
    ? `<button class="post-delete" onclick="deletePost(${post.id})" title="Delete post">✕</button>`
    : '';

  const avatarContent = post.author_avatar
    ? `<img src="${post.author_avatar}" alt="${esc(post.author_username)}" />`
    : (((post.author_name?.[0] || '') + '') || post.author_username?.[0]?.toUpperCase() || '?').toUpperCase();

  return `
    <div class="post-header">
      <div class="post-avatar" onclick="viewProfile('${esc(post.author_username)}')">${avatarContent}</div>
      <div class="post-meta">
        <div class="post-author" onclick="viewProfile('${esc(post.author_username)}')">${esc(authorName)}</div>
        <div class="post-username">@${esc(post.author_username)} · <span class="post-time">${time}</span></div>
      </div>
      ${delBtn}
    </div>
    <div class="post-content">${esc(post.content)}</div>
    ${img}
    <div class="post-actions">
      <button class="action-btn ${likedClass}" id="like-btn-${post.id}" onclick="toggleLike(${post.id})">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span id="like-count-${post.id}">${post.likes_count}</span>
      </button>
      <button class="action-btn" onclick="openComments(${post.id})">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <span id="comment-count-${post.id}">${post.comments_count}</span>
      </button>
    </div>`;
}

async function toggleLike(postId) {
  if (!currentUser) { showToast('Please log in to like posts.', 'error'); return; }
  const btn       = document.getElementById(`like-btn-${postId}`);
  const countEl   = document.getElementById(`like-count-${postId}`);
  if (!btn) return;
  try {
    const res = await apiFetch(`/posts/${postId}/like/`, { method: 'POST' });
    btn.classList.toggle('liked', res.liked);
    if (countEl) countEl.textContent = res.likes_count;
  } catch { /* silent */ }
}

async function deletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await apiFetch(`/posts/${postId}/`, { method: 'DELETE' });
    document.getElementById(`post-${postId}`)?.remove();
    showToast('Post deleted.');
  } catch { showToast('Could not delete post.', 'error'); }
}

function switchFeed(type, btn) {
  activeFeed = type;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPosts();
}

/* ══════════════════════════════════════════════════════════
   CREATE POST MODAL
══════════════════════════════════════════════════════════ */
function openPostModal() {
  document.getElementById('post-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('post-content').focus(), 60);
}

function closePostModal(e) {
  if (e && e.target !== document.getElementById('post-modal')) return;
  document.getElementById('post-modal').classList.add('hidden');
  document.getElementById('post-content').value = '';
  document.getElementById('char-used').textContent = '0';
  removePostImage();
}

function previewPostImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  postImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('post-img-thumb').src = e.target.result;
    document.getElementById('post-image-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removePostImage() {
  postImageFile = null;
  document.getElementById('post-image-preview')?.classList.add('hidden');
  const inp = document.getElementById('post-image-input');
  if (inp) inp.value = '';
}

async function createPost() {
  const content = document.getElementById('post-content').value.trim();
  if (!content && !postImageFile) {
    showToast('Please write something first.', 'error'); return;
  }

  let body;
  if (postImageFile) {
    body = new FormData();
    body.append('content', content);
    body.append('image', postImageFile);
  } else {
    body = JSON.stringify({ content });
  }

  try {
    const post = await apiFetch('/posts/', { method: 'POST', body });
    closePostModal();
    // Close modal then add to feed
    const container = document.getElementById('posts-container');
    const emptyEl   = container.querySelector('.empty-state');
    if (emptyEl) emptyEl.remove();
    container.prepend(buildPostEl(post));
    showToast('Post published! ✦');
  } catch (e) {
    showToast('Failed to publish post.', 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   COMMENTS MODAL
══════════════════════════════════════════════════════════ */
function openComments(postId) {
  activeCommentPostId = postId;
  document.getElementById('comments-modal').classList.remove('hidden');
  loadComments(postId);
  setTimeout(() => document.getElementById('comment-input').focus(), 80);
}

function closeCommentsModal(e) {
  if (e && e.target !== document.getElementById('comments-modal')) return;
  document.getElementById('comments-modal').classList.add('hidden');
  activeCommentPostId = null;
}

async function loadComments(postId) {
  const list = document.getElementById('comments-list');
  list.innerHTML = '<div class="loading-spinner">Loading…</div>';
  try {
    const comments = await apiFetch(`/posts/${postId}/comments/`);
    if (!comments.length) {
      list.innerHTML = `<div class="empty-state" style="padding:1.5rem">
        <span class="empty-icon">💬</span>
        <p>No comments yet. Start the conversation!</p>
      </div>`;
      return;
    }
    list.innerHTML = '';
    comments.forEach(c => list.appendChild(buildCommentEl(c)));
    list.scrollTop = list.scrollHeight;
  } catch {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:1rem">Failed to load comments.</p>';
  }
}

function buildCommentEl(c) {
  const el = document.createElement('div');
  el.className = 'comment';
  const avatarContent = c.author_avatar
    ? `<img src="${c.author_avatar}" alt="${esc(c.author_username)}" />`
    : c.author_username[0].toUpperCase();
  el.innerHTML = `
    <div class="comment-avatar">${avatarContent}</div>
    <div class="comment-body">
      <div class="comment-author">${esc(c.author_name || c.author_username)}</div>
      <div class="comment-text">${esc(c.content)}</div>
      <div class="comment-time">${timeAgo(c.created_at)}</div>
    </div>`;
  return el;
}

async function submitComment() {
  if (!activeCommentPostId) return;
  if (!currentUser) { showToast('Please log in to comment.', 'error'); return; }
  const input   = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;
  try {
    const comment = await apiFetch(`/posts/${activeCommentPostId}/comments/`, {
      method: 'POST', body: JSON.stringify({ content })
    });
    input.value = '';
    const list   = document.getElementById('comments-list');
    const emptyEl = list.querySelector('.empty-state');
    if (emptyEl) emptyEl.remove();
    list.appendChild(buildCommentEl(comment));
    list.scrollTop = list.scrollHeight;

    // Update comment count on post card
    const countEl = document.getElementById(`comment-count-${activeCommentPostId}`);
    if (countEl) countEl.textContent = parseInt(countEl.textContent || 0) + 1;
  } catch { showToast('Could not post comment.', 'error'); }
}

/* ══════════════════════════════════════════════════════════
   EXPLORE / USERS
══════════════════════════════════════════════════════════ */
async function loadUsers(query) {
  const container = document.getElementById('users-container');
  container.innerHTML = '<div class="loading-spinner">Loading users…</div>';
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  try {
    const users = await apiFetch(`/users/${qs}`);
    const filtered = users.filter(u => u.id !== currentUser?.id);
    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state">
        <span class="empty-icon">🔍</span>
        <h4>No users found</h4>
        <p>${query ? `No results for "${esc(query)}"` : 'No users yet.'}</p>
      </div>`;
      return;
    }
    container.innerHTML = '';
    filtered.forEach(u => container.appendChild(buildUserCard(u)));
  } catch {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">Failed to load users.</p>';
  }
}

function buildUserCard(user) {
  const el     = document.createElement('div');
  el.className = 'user-card';
  el.id = `user-card-${user.id}`;
  const name   = fullName(user);
  const avatarContent = user.profile?.avatar
    ? `<img src="${user.profile.avatar}" alt="${esc(user.username)}" />`
    : name[0].toUpperCase();
  const isFollowing = user.is_following;

  el.innerHTML = `
    <div class="user-card-avatar" onclick="viewProfile('${esc(user.username)}')">${avatarContent}</div>
    <div class="user-card-info">
      <div class="user-card-name" onclick="viewProfile('${esc(user.username)}')">${esc(name)}</div>
      <div class="user-card-handle">@${esc(user.username)}</div>
      <div class="user-card-stats">
        <span><strong>${user.followers_count}</strong> followers</span>
        <span><strong>${user.posts_count}</strong> posts</span>
      </div>
    </div>
    ${currentUser
      ? `<button class="btn-follow ${isFollowing ? 'following' : ''}"
           onclick="toggleFollow('${esc(user.username)}', this)">
           ${isFollowing ? 'Following' : 'Follow'}
         </button>`
      : ''}`;
  return el;
}

function searchUsers(q) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadUsers(q), 320);
}

/* ══════════════════════════════════════════════════════════
   FOLLOW SYSTEM
══════════════════════════════════════════════════════════ */
async function toggleFollow(username, btn) {
  if (!currentUser) { showToast('Please log in first.', 'error'); return; }
  try {
    const res = await apiFetch(`/users/${username}/follow/`, { method: 'POST' });
    const isNow = res.following;
    btn.textContent = isNow ? 'Following' : 'Follow';
    btn.classList.toggle('following', isNow);

    // Update profile stats if visible
    const follEl = document.getElementById('prof-followers');
    if (follEl) follEl.textContent = res.followers_count;

    showToast(isNow ? `Following @${username}` : `Unfollowed @${username}`);
    // Refresh suggestions
    loadSuggestions();
  } catch { showToast('Could not update follow.', 'error'); }
}

/* ══════════════════════════════════════════════════════════
   SUGGESTIONS (right panel)
══════════════════════════════════════════════════════════ */
async function loadSuggestions() {
  const list = document.getElementById('suggestions-list');
  if (!list) return;
  try {
    const users    = await apiFetch('/users/');
    const filtered = users
      .filter(u => u.id !== currentUser?.id && !u.is_following)
      .slice(0, 6);
    if (!filtered.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:.83rem;padding:.3rem">You\'re following everyone! 🎉</p>';
      return;
    }
    list.innerHTML = '';
    filtered.forEach(u => list.appendChild(buildSuggestionItem(u)));
  } catch { list.innerHTML = ''; }
}

function buildSuggestionItem(user) {
  const el     = document.createElement('div');
  el.className = 'suggestion-item';
  const name   = fullName(user);
  const avatarContent = user.profile?.avatar
    ? `<img src="${user.profile.avatar}" alt="${esc(user.username)}" />`
    : name[0].toUpperCase();
  el.innerHTML = `
    <div class="suggestion-avatar">${avatarContent}</div>
    <div class="suggestion-info">
      <div class="suggestion-name" onclick="viewProfile('${esc(user.username)}')">${esc(name)}</div>
      <div class="suggestion-handle">@${esc(user.username)}</div>
    </div>
    ${currentUser
      ? `<button class="btn-follow-sm" onclick="toggleFollow('${esc(user.username)}', this)">Follow</button>`
      : ''}`;
  return el;
}

/* ══════════════════════════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════════════════════════ */
async function viewProfile(username) {
  if (!username) return;
  // Switch to profile tab
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  document.getElementById('page-profile').classList.add('active');
  document.querySelector('.nav-link[data-page="profile"]').classList.add('active');

  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="loading-spinner">Loading profile…</div>';

  try {
    const [user, posts] = await Promise.all([
      apiFetch(`/users/${username}/`),
      apiFetch(`/users/${username}/posts/`)
    ]);
    renderProfile(user, posts, content);
  } catch {
    content.innerHTML = `<div class="empty-state">
      <span class="empty-icon">⚠️</span>
      <h4>Profile not found</h4>
      <p>@${esc(username)} doesn't exist.</p>
    </div>`;
  }
}

function renderProfile(user, posts, container) {
  const isMe        = currentUser?.id === user.id;
  const name        = fullName(user);
  const bio         = user.profile?.bio      || '';
  const website     = user.profile?.website  || '';
  const location    = user.profile?.location || '';
  const isFollowing = user.is_following;

  const avatarContent = user.profile?.avatar
    ? `<img src="${user.profile.avatar}" alt="${esc(user.username)}" />`
    : initials(user);

  const avatarUploadBtn = isMe
    ? `<label class="profile-avatar-upload" for="avatar-file-input" title="Change photo">📷 Change</label>
       <input type="file" id="avatar-file-input" accept="image/*" style="display:none"
              onchange="uploadAvatar(event)" />`
    : '';

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-cover"></div>
      <div class="profile-body">
        <div class="profile-top">
          <div class="profile-avatar">
            ${avatarContent}
            ${avatarUploadBtn}
          </div>
          <div class="profile-actions">
            ${isMe
              ? `<button class="btn-edit" onclick="toggleEditProfile()">✏ Edit Profile</button>`
              : currentUser
                ? `<button class="btn-follow ${isFollowing ? 'following' : ''}"
                     onclick="toggleFollow('${esc(user.username)}', this)">
                     ${isFollowing ? 'Following' : 'Follow'}
                   </button>`
                : ''
            }
          </div>
        </div>

        <div class="profile-name">${esc(name)}</div>
        <div class="profile-username">@${esc(user.username)}</div>
        ${bio      ? `<div class="profile-bio">${esc(bio)}</div>` : ''}
        ${(location || website) ? `
          <div class="profile-meta">
            ${location ? `<span>📍 ${esc(location)}</span>` : ''}
            ${website  ? `<span>🔗 <a href="${esc(website)}" target="_blank" rel="noopener">${esc(website)}</a></span>` : ''}
          </div>` : ''}

        <div class="profile-stats">
          <div class="stat">
            <span class="stat-value">${user.posts_count}</span>
            <span class="stat-label">Posts</span>
          </div>
          <div class="stat clickable" onclick="openFollowersModal('${esc(user.username)}', 'followers')">
            <span class="stat-value" id="prof-followers">${user.followers_count}</span>
            <span class="stat-label">Followers</span>
          </div>
          <div class="stat clickable" onclick="openFollowersModal('${esc(user.username)}', 'following')">
            <span class="stat-value">${user.following_count}</span>
            <span class="stat-label">Following</span>
          </div>
        </div>
      </div>
    </div>

    ${isMe ? `
      <div id="edit-profile-card" class="edit-profile-card" style="display:none;">
        <h4>Edit Profile</h4>
        <div class="edit-form">
          <div class="form-row">
            <div class="form-group">
              <label>First Name</label>
              <input id="ef-first" value="${esc(user.first_name || '')}" placeholder="First name" />
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <input id="ef-last" value="${esc(user.last_name || '')}" placeholder="Last name" />
            </div>
          </div>
          <div class="form-group">
            <label>Bio</label>
            <input id="ef-bio" value="${esc(bio)}" placeholder="Tell the world about yourself…" />
          </div>
          <div class="form-group">
            <label>Location</label>
            <input id="ef-location" value="${esc(location)}" placeholder="City, Country" />
          </div>
          <div class="form-group">
            <label>Website</label>
            <input id="ef-website" value="${esc(website)}" placeholder="https://yoursite.com" />
          </div>
          <div class="edit-actions">
            <button class="btn-secondary" onclick="toggleEditProfile()">Cancel</button>
            <button class="btn-primary" onclick="saveProfile()">Save Changes</button>
          </div>
        </div>
      </div>` : ''}

    <div class="page-header" style="margin-top:1.5rem">
      <h2>${isMe ? 'Your Posts' : 'Posts'}</h2>
    </div>
    <div id="profile-posts" class="posts-container"></div>`;

  // Render posts
  const profilePostsEl = document.getElementById('profile-posts');
  if (!posts.length) {
    profilePostsEl.innerHTML = `<div class="empty-state">
      <span class="empty-icon">✦</span>
      <h4>No posts yet</h4>
      <p>${isMe ? 'Share something with the world!' : `@${esc(user.username)} hasn't posted yet.`}</p>
    </div>`;
  } else {
    posts.forEach(post => profilePostsEl.appendChild(buildPostEl(post)));
  }
}

function toggleEditProfile() {
  const card = document.getElementById('edit-profile-card');
  if (card) card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

async function saveProfile() {
  const body = new FormData();
  body.append('first_name', document.getElementById('ef-first').value);
  body.append('last_name',  document.getElementById('ef-last').value);
  body.append('bio',        document.getElementById('ef-bio').value);
  body.append('location',   document.getElementById('ef-location').value);
  body.append('website',    document.getElementById('ef-website').value);

  try {
    currentUser = await apiFetch('/me/', { method: 'PATCH', body });
    updateSidebarUser();
    showToast('Profile updated! ✓');
    viewProfile(currentUser.username);
  } catch { showToast('Failed to save profile.', 'error'); }
}

async function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  try {
    currentUser = await apiFetch('/me/', { method: 'PATCH', body: fd });
    updateSidebarUser();
    showToast('Avatar updated! ✓');
    viewProfile(currentUser.username);
  } catch { showToast('Failed to upload avatar.', 'error'); }
}

/* ══════════════════════════════════════════════════════════
   FOLLOWERS / FOLLOWING MODAL
══════════════════════════════════════════════════════════ */
async function openFollowersModal(username, mode) {
  followersModalMode = mode;
  followersModalUser = username;
  const modal     = document.getElementById('followers-modal');
  const title     = document.getElementById('followers-modal-title');
  const listEl    = document.getElementById('followers-list');
  title.textContent = mode === 'followers' ? 'Followers' : 'Following';
  listEl.innerHTML  = '<div class="loading-spinner">Loading…</div>';
  modal.classList.remove('hidden');

  try {
    const endpoint = mode === 'followers'
      ? `/users/${username}/followers/`
      : `/users/${username}/following/`;
    const users = await apiFetch(endpoint);
    if (!users.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:1.5rem">
        <span class="empty-icon">👥</span>
        <p>${mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>
      </div>`;
      return;
    }
    listEl.innerHTML = '';
    users.forEach(u => listEl.appendChild(buildFollowItem(u)));
  } catch {
    listEl.innerHTML = '<p style="color:var(--muted);text-align:center;padding:1rem">Failed to load.</p>';
  }
}

function closeFollowersModal(e) {
  if (e && e.target !== document.getElementById('followers-modal')) return;
  document.getElementById('followers-modal').classList.add('hidden');
}

function buildFollowItem(user) {
  const el     = document.createElement('div');
  el.className = 'follow-item';
  const name   = fullName(user);
  const avatarContent = user.profile?.avatar
    ? `<img src="${user.profile.avatar}" alt="${esc(user.username)}" />`
    : name[0].toUpperCase();

  el.innerHTML = `
    <div class="follow-item-avatar" onclick="closeFollowersModal();viewProfile('${esc(user.username)}')">${avatarContent}</div>
    <div class="follow-item-info">
      <div class="follow-item-name" onclick="closeFollowersModal();viewProfile('${esc(user.username)}')">${esc(name)}</div>
      <div class="follow-item-handle">@${esc(user.username)}</div>
    </div>
    ${currentUser && user.id !== currentUser.id
      ? `<button class="btn-follow-sm ${user.is_following ? 'following' : ''}"
           onclick="toggleFollow('${esc(user.username)}', this)">
           ${user.is_following ? 'Following' : 'Follow'}
         </button>`
      : ''}`;
  return el;
}

/* ══════════════════════════════════════════════════════════
   NOTIFICATIONS
══════════════════════════════════════════════════════════ */
async function pollNotifications() {
  if (!currentUser) return;
  try {
    const res = await apiFetch('/notifications/unread-count/');
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    if (res.unread > 0) {
      badge.textContent = res.unread > 99 ? '99+' : res.unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch { /* silent */ }
}

async function loadNotifications() {
  const container = document.getElementById('notif-container');
  container.innerHTML = '<div class="loading-spinner">Loading…</div>';
  try {
    const notifs = await apiFetch('/notifications/');
    // Mark all as read after viewing
    apiFetch('/notifications/read/', { method: 'POST' }).then(() => {
      document.getElementById('notif-badge')?.classList.add('hidden');
    });

    if (!notifs.length) {
      container.innerHTML = `<div class="empty-state">
        <span class="empty-icon">🔔</span>
        <h4>No notifications</h4>
        <p>When someone likes, comments, or follows you — it'll show up here.</p>
      </div>`;
      return;
    }
    container.innerHTML = '';
    notifs.forEach(n => container.appendChild(buildNotifEl(n)));
  } catch {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">Failed to load notifications.</p>';
  }
}

function buildNotifEl(n) {
  const el     = document.createElement('div');
  el.className = `notif-item ${n.is_read ? '' : 'unread'}`;
  const icons  = { like: '♥', comment: '💬', follow: '👤' };
  const avatarContent = n.sender_avatar
    ? `<img src="${n.sender_avatar}" alt="${esc(n.sender_username)}" />`
    : (n.sender_username?.[0]?.toUpperCase() || '?');

  el.innerHTML = `
    <div class="notif-avatar">${avatarContent}</div>
    <div class="notif-icon ${n.notif_type}">${icons[n.notif_type] || '•'}</div>
    <div class="notif-body">
      <div class="notif-message">${esc(n.message)}</div>
      <div class="notif-time">${timeAgo(n.created_at)}</div>
    </div>`;
  return el;
}

async function markAllRead() {
  try {
    await apiFetch('/notifications/read/', { method: 'POST' });
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    document.getElementById('notif-badge')?.classList.add('hidden');
    showToast('All notifications marked as read.');
  } catch { /* silent */ }
}

/* ══════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, type = 'default') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3000);
}

/* ══════════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════ */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
