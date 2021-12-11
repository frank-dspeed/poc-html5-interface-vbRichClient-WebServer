import './microphone/microphone.js';

/**
 * 
 * @param {HTMLElement} el 
 */
export const render = (el) => {
    el.innerHTML = `<p>This allows you to take a opus encoded Audio Stream</p><br />
    <button disabled>Import Audio via WebSocket</button>
    <br /><microphone-mode></microphone-mode>`;
}