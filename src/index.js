// Load the App
customElements.define('radio-station-interface', class extends HTMLElement {
    async connectedCallback() {
        const createRadioStationInterface = await import('./components/radio-station-interface/radio-station-interface.js')
        createRadioStationInterface.render(this);
    }
})

// @ts-ignore
window.document.querySelector('body').append(document.createElement('radio-station-interface'));