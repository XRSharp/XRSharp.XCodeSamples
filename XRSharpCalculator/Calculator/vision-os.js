socket = new WebSocket("ws://localhost:9090/ws");
socket.addEventListener("open", () => {
    console.log('Socket connected.');
});

function createObject3D(json) {
    console.log(json);
    let obj3D = JSON.parse(json);
    if(obj3D.size != undefined)
        obj3D.size = JSON.stringify(obj3D.size);
    
    if(obj3D.position != undefined)
        obj3D.position = JSON.stringify(obj3D.position);
    
    if(obj3D.fontSize != undefined)
        obj3D.fontSize = JSON.stringify(obj3D.fontSize);
    
    if(obj3D.thickness != undefined)
        obj3D.thickness = JSON.stringify(obj3D.thickness);
    
    if(obj3D.radius != undefined)
        obj3D.radius = JSON.stringify(obj3D.radius);
    
    let message = {
        command: 'add-entity-3d',
        data: obj3D
    };
    
    send(JSON.stringify(message));
}

function send(message){
    if(socket){
        socket.send(message);
        console.log('Message sent.');
    }
}
