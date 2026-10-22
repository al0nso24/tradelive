const http = require('http'); //crea el servidor
const fs = require('fs'); //lee los archivos
const path = require('path'); //construye rutas de archivos
const { WebSocketServer, WebSocket } = require('ws');

const PUERTO = 3004;

//Precio actual simulado de cada moneda
const precios = { BTC: 65000, ETH: 3200, SOL: 150 };

//Tipo de contenido que recibe el navegador
const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
};

const servidor = http.createServer((req, res) => {
    const ruta = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
    //server.js se encuentra en __dirname
    const archivo = path.join(__dirname, ruta);

    //Si el archivo no existe responde con un error 404
    if (path.dirname(archivo) !== __dirname || !fs.existsSync(archivo)) {
        res.writeHead(404);
        return res.end('No encontrado');
    }

    //Muestra el contenido
    res.writeHead(200, {
        'Content-Type': tipos[path.extname(archivo)] || 'application/octet-stream',
    });
    fs.createReadStream(archivo).pipe(res);
});

//Esto crea el servidor WebSocket
const wss = new WebSocketServer({ server: servidor });

function revisarAlertas(cliente) {
    cliente.alertas = cliente.alertas.filter((a) => {
        const actual = precios[a.moneda];
        const cumple = a.condicion === 'mayor'
            ? actual >= a.precio
            : actual <= a.precio;
        if (!cumple) return true;

        const signo = a.condicion === 'mayor' ? '≥' : '≤';
        cliente.send(JSON.stringify({
            tipo: 'alerta',
            texto: `${a.moneda} llegó a $${actual} (${signo} $${a.precio})`,
        }));
        console.log('Alerta disparada:', a.moneda, a.condicion, a.precio);
        return false;
    });
}

//Atender una nueva conexión
wss.on('connection', (socket) => {
    socket.alertas = []; //cada conexión tiene su lista de alertas
    console.log(`Trader conectado (${wss.clients.size} en línea)`);
    //Al conectarse automáticamente recibes los precios actuales
    //JSON.stringify convierte el objeto de JS para enviarlo como texto
    socket.send(JSON.stringify({ tipo: 'precios', datos: precios, hora: Date.now() }));

    socket.on('message', (datos) => {
        //Convierte el texto recibido
        let msg;
        try {
            msg = JSON.parse(datos.toString());
        } catch {
            return;
        }

        //Valida que el mensaje, la moneda, la condición y el precio sean aceptables
        const valida = msg.tipo === 'nuevaAlerta'
            && Object.hasOwn(precios, msg.moneda)
            && ['mayor', 'menor'].includes(msg.condicion)
            && Number.isFinite(Number(msg.precio))
            && Number(msg.precio) > 0;
        if (!valida) return;

        socket.alertas.push({
            moneda: msg.moneda,
            condicion: msg.condicion,
            precio: Number(msg.precio),
        });
        const signo = msg.condicion === 'mayor' ? '≥' : '≤';
        socket.send(JSON.stringify({
            tipo: 'info',
            texto: `Alerta creada: ${msg.moneda} ${signo} $${msg.precio}`,
        }));
    });

    socket.on('close', () => {
        console.log(`Trader desconectado (${wss.clients.size} en línea)`);
    });
});

//Repite su contenido cada 1000 milisegundos (cada segundo)
setInterval(() => {
    for (const moneda in precios) {
        const variacion = (Math.random() * 2 - 1) / 100;
        precios[moneda] = +(precios[moneda] * (1 + variacion)).toFixed(2);
    }

    //Prepara el mensaje con los precios y la hora para enviarselo al navegador conectado
    const paquete = JSON.stringify({ tipo: 'precios', datos: precios, hora: Date.now() });
    //wss.clients contiene las conexiones abiertas. A cada una le manda los precios y revisa sus alertas
    wss.clients.forEach((cliente) => {
        if (cliente.readyState === WebSocket.OPEN) {
            cliente.send(paquete);
            revisarAlertas(cliente); //recorre las alertas del navegador
        }
    });
}, 1000); //1000 milisegundos = 1 segundo

//Encender el servidor
servidor.listen(PUERTO, () => {
    console.log(`TradeLive en http://localhost:${PUERTO}`);
});