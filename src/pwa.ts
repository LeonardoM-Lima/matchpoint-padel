import { registerSW } from 'virtual:pwa-register';

const showUpdatePrompt = (refresh: () => void) => {
  if (document.getElementById('pwa-update-prompt')) {
    return;
  }

  const prompt = document.createElement('div');
  prompt.id = 'pwa-update-prompt';
  prompt.setAttribute('role', 'status');
  prompt.style.position = 'fixed';
  prompt.style.left = '16px';
  prompt.style.right = '16px';
  prompt.style.bottom = '16px';
  prompt.style.zIndex = '9999';
  prompt.style.display = 'flex';
  prompt.style.alignItems = 'center';
  prompt.style.justifyContent = 'space-between';
  prompt.style.gap = '12px';
  prompt.style.maxWidth = '480px';
  prompt.style.margin = '0 auto';
  prompt.style.padding = '12px 14px';
  prompt.style.border = '1px solid rgba(0, 201, 128, 0.45)';
  prompt.style.borderRadius = '14px';
  prompt.style.background = '#0A1628';
  prompt.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.35)';
  prompt.style.color = '#FFFFFF';
  prompt.style.fontFamily = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  prompt.style.fontSize = '14px';

  const message = document.createElement('span');
  message.textContent = 'Nova versao disponivel.';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '8px';

  const updateButton = document.createElement('button');
  updateButton.type = 'button';
  updateButton.textContent = 'Atualizar';
  updateButton.style.border = '0';
  updateButton.style.borderRadius = '999px';
  updateButton.style.background = '#00C980';
  updateButton.style.color = '#06111F';
  updateButton.style.cursor = 'pointer';
  updateButton.style.fontWeight = '700';
  updateButton.style.padding = '8px 12px';
  updateButton.addEventListener('click', refresh);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Fechar aviso de atualizacao');
  closeButton.textContent = 'x';
  closeButton.style.width = '32px';
  closeButton.style.height = '32px';
  closeButton.style.border = '1px solid rgba(255, 255, 255, 0.18)';
  closeButton.style.borderRadius = '999px';
  closeButton.style.background = 'transparent';
  closeButton.style.color = '#FFFFFF';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '16px';
  closeButton.addEventListener('click', () => prompt.remove());

  actions.append(updateButton, closeButton);
  prompt.append(message, actions);
  document.body.append(prompt);
};

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdatePrompt(() => {
      void updateSW(true);
    });
  },
  onOfflineReady() {
    console.info('EvoPadel pronto para uso offline.');
  },
});
