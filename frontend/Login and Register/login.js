const API_BASE_URL = ''; // Relative — works in both dev and production

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
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    statusMessage.textContent = data.message;

    if (response.ok) {
      // equivalent to onSuccess()
      window.location.href = `${API_BASE_URL}/`;
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
