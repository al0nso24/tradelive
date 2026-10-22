const socket = new WebSocket('ws://' + location.host);
const anteriores = {}; //último precio de cada moneda (para ▲/▼)
const historialBTC = []; //últimos 30 precios del BTC (gráfico)
const estado = document.getElementById('estado');
socket.onopen = () => { estado.textContent = ' En vivo'; };
socket.onclose = () => { estado.textContent = ' Sin conexión'; };

//Decidir qué hacer según el tipo de mensaje
socket.onmessage = (evento) => {
    const msg = JSON.parse(evento.data);
    if (msg.tipo === 'precios') pintarPrecios(msg.datos, msg.hora);
    if (msg.tipo === 'alerta' || msg.tipo === 'info') avisar(msg.texto);
};

//Pintar la tabla con flechas ▲ (sube) y ▼ (baja), compara cada precio con el anterior
function pintarPrecios(datos, hora) {
    let filas = '';
    for (const moneda in datos) {
        const actual = datos[moneda];
        const previo = anteriores[moneda] ?? actual;
        const cambio = ((actual - previo) / previo * 100).toFixed(2);
        const clase = actual >= previo ? 'sube' : 'baja';
        const flecha = actual >= previo ? '▲' : '▼';
        filas += `<tr><td><b>${moneda}</b></td>
                            <td class="${clase}">$${actual.toLocaleString('en-US')}</td>
                            <td class="${clase}">${flecha} ${cambio}%</td></tr>`;
        anteriores[moneda] = actual;
    }
    document.getElementById('tabla').innerHTML = filas;
    document.getElementById('hora').textContent =
        new Date(hora).toLocaleTimeString();

    historialBTC.push(datos.BTC);
    if (historialBTC.length > 30) historialBTC.shift();
    dibujarGrafico();
}

//Dibujar el gráfico de líneas del BTC con <canvas>
function dibujarGrafico() {
    const c = document.getElementById('grafico');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const min = Math.min(...historialBTC);
    const max = Math.max(...historialBTC);
    const rango = (max - min) || 1;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    historialBTC.forEach((p, i) => {
        const x = i * (c.width / 29);
        const y = c.height - 15 - ((p - min) / rango) * (c.height - 30);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Arial';
    ctx.fillText('BTC últimos 30 s', 8, 14);
}

//Crear una alerta y mostrar los avisos
//Lee moneda, condición y precio, y manda esos datos al servidor.
document.getElementById('btnAlerta').onclick = () => {
    const precio = Number(document.getElementById('precio').value);
    if (!precio) return avisar(' Escribe un precio válido');
    socket.send(JSON.stringify({
        tipo: 'nuevaAlerta',
        moneda: document.getElementById('moneda').value,
        condicion: document.getElementById('condicion').value,
        precio,
    }));
};

//Agrega mensajes con la hora a la página
function avisar(texto) {
    //Crea un div
    const div = document.createElement('div');
    //Coloca el mensaje con la hora actual
    div.textContent = new Date().toLocaleTimeString() + ' — ' + texto;
    document.getElementById('avisos').prepend(div);
}