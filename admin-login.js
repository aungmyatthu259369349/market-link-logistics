document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePwdBtn');
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('errorMsg');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = form.username.value.trim();
    const password = passwordInput.value;

    err.style.display = 'none';
    btn.classList.add('loading');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (res.ok && data && data.success && data.user && data.user.role === 'admin') {
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        window.location.href = 'admin.html';
      } else {
        err.textContent = (data && data.error) || '用户名或密码错误';
        err.style.display = 'block';
      }
    } catch (e) {
      err.textContent = '网络异常，请稍后再试';
      err.style.display = 'block';
    } finally {
      btn.classList.remove('loading');
    }
  }

  form.addEventListener('submit', handleLogin);
});
