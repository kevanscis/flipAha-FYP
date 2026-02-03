const API_BASE_URL = 'http://localhost:3000';

const form = document.getElementById('signUpForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const statusMessage = document.getElementById('statusMessage');
const submitButton = form.querySelector('button');

const isAdminCheckbox = document.getElementById('isAdmin');
const adminCodeRow = document.getElementById('adminCodeRow');
const adminCodeInput = document.getElementById('adminCode');

/* Show / hide admin code field */
isAdminCheckbox.addEventListener('change', () => {
  adminCodeRow.style.display = isAdminCheckbox.checked ? 'block' : 'none';
  adminCodeInput.value = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  const isAdmin = isAdminCheckbox.checked;
  const adminCode = adminCodeInput.value.trim();

  if (!username || !password) {
    statusMessage.textContent = 'Please enter username and password';
    return;
  }

  if (isAdmin && !adminCode) {
    statusMessage.textContent = 'Please enter admin code';
    return;
  }

  setLoading(true);
  statusMessage.textContent = 'Signing up...';

  try {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        isAdmin,
        adminCode
      })
    });

    const data = await response.json();
    statusMessage.textContent = data.message;

    if (response.ok) {
      window.location.href = 'login.html';
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
  adminCodeInput.disabled = isLoading;
  submitButton.disabled = isLoading;
}
