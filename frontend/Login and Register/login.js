const API_BASE_URL = ''; // change to your backend URL

const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const statusMessage = document.getElementById('statusMessage');
const submitButton = form.querySelector('button');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    statusMessage.textContent = 'Please enter username and password';
    return;
  }

  setLoading(true);
  statusMessage.textContent = 'Logging in...';

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    statusMessage.textContent = data.message;

    if (response.ok) {
      // Confirm session cookie is visible to subsequent requests before redirect.
      const meResponse = await fetch(`${API_BASE_URL}/api/me`, {
        credentials: 'include'
      });
      const meData = await meResponse.json();

      if (meData.logged_in) {
        window.location.href = `${API_BASE_URL}/`;
      } else {
        statusMessage.textContent = 'Login succeeded but session was not persisted. Please allow cookies for this site and try again.';
      }
    }
  } catch (err) {
    console.error(err);
    statusMessage.textContent = 'Server error';
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  usernameInput.disabled = isLoading;
  passwordInput.disabled = isLoading;
  submitButton.disabled = isLoading;
}
