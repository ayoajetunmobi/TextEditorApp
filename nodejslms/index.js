const { Socket } = require('dgram');
const express = require('express');
const http = require('http');
const sockertio = require('socket.io');


const app = express();
const server = http.createServer(app);
let connected_owners =[];
let idcount = 0;

// normal socket config
// const io= sockertio(server)
//configure socket with cors

const allowedOrigins = ["http://localhost:3000"];
const socketIo = sockertio(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type","Authorization"], // Optional: for custom headers
        credentials: true // Optional: for handling cookies
    }
});

socketIo.on('connection', (socket)=>{
    console.log('cliient connected',socket.id);
    // Receive message with specfic parameters (e.g, username, room, message)
    // socket.on('send message',())


    // Event for a client to join a specific group/room
    socket.on('joingroup', (groupData) => {
        const {username,groupname,key,owner,color} = groupData;
        const newuser={
            username:username,
            groupname:groupname,
            key:key,
            owner:owner,
            id:socket.id,
        }
        
        if (owner === true){
            const owner_check = connected_owners.find(user => user.username === username && user.groupname === groupname);
            if (owner_check != undefined){
                connected_owners = connected_owners.filter((users) => users.username !== username && users.groupname !== groupname);
                connected_owners.push(newuser);
            }else{
                socket.join(groupname);
                connected_owners.push(newuser);
                socketIo.to(socket.id).emit('youjsutjoined',{group:groupname,owner:username});
            }
        }else{
            const verify_grpKey= connected_owners.find(user=>user.groupname== groupname && user.key ==key);

            if(verify_grpKey != undefined){
                console.log(username,socket.id)
                socket.join(groupname);
                socketIo.to(socket.id).emit('youjsutjoined',{group:groupname,owner:verify_grpKey.username});
            }
        }
        console.log(`Client ${socket.id}`,"groupdata",groupname);
    });


    // Event for receiving a message from a client for a specific group
    socket.on('sendGroupMessage', (data) => {
        const { username, groupname, msg,owner } = data;
        // Emit the message to all clients in the specific room, including the sender
        if (owner){
           socketIo.to(groupname).emit('receive_message', { username:username,msg:msg,owner:owner});
        }else{
            socketIo.to(groupname).emit('receive_message', { username:username,msg:msg,owner:owner});
        }
        
    });

    socket.on("sendchanges_masters",(data)=>{
        const { username, groupname, msg, owner,color } = data;
        if(!owner){
            idcount=idcount+1;
            console.log("gotten changes",idcount);
            const owner_send = connected_owners.find(owna=> owna.groupname == groupname);
            socketIo.to(owner_send.id).emit('recieve_editted', { username:username,msg:msg,owner:owner,color:color,id:idcount});
        }
    })

    // Optional: Event to broadcast to all other users in the channel except the sender
    // socket.on('sendGroupMessageOthers', (data) => {
    //     const { groupName, message, user } = data;
    //     socket.broadcast.to(groupName).emit('receiveGroupMessage', { user, message, groupName });
    // });


    // Handle disconnection
    socket.on('disconnect', () => {
       const owner = connected_owners.find(user => {
            user.id === socket.id;
       });

        if(owner != undefined){
            connected_owners = connected_owners.filter(users=>users.id != owner.id);
        };
       console.log('Client disconnected');
    });
});

// Start the server listening on the defined port
server.listen(8000, () => {
   console.log(`Server running on http://localhost:8000`);
});