'use strict';

const demo = document.querySelector('#compat-demo');
const result = document.querySelector('#compat-demo-result');
const heading = result.querySelector('h3');
const message = result.querySelector('p');
const initial = { heading: heading.textContent, message: message.textContent };

function showResult(state, title, description) {
  result.dataset.state = state;
  heading.textContent = title;
  message.textContent = description;
}

demo.addEventListener('submit', (event) => {
  event.preventDefault();
  const setup = new FormData(demo);

  if (setup.get('sistema') === 'windows-11-x64') {
    showResult(
      'pending',
      'Combinação ainda em avaliação',
      'O Windows 11 de 64 bits faz parte do estudo. Ainda não há cobertura confirmada para o jogo e a região escolhidos.'
    );
    return;
  }

  showResult(
    'outside',
    'Sistema fora do recorte inicial',
    'O estudo atual está concentrado no Windows 11 de 64 bits.'
  );
});

demo.addEventListener('change', () => {
  if (result.dataset.state !== 'idle') {
    showResult('idle', initial.heading, initial.message);
  }
});

demo.querySelector('button[type="submit"]').disabled = false;
