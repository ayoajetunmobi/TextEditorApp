const { Socket } = require('dgram');
const express = require('express');
const http = require('http');
const sockertio = require('socket.io');

const app = express();
const server = http.createServer(app);
let connected_owners = [];
let group_docs = {}; // Stores the latest document state per groupname
let idcount = 0;

const allowedOrigins = ["http://localhost:3000"];
const socketIo = sockertio(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    }
});

socketIo.on('connection', (socket) => {
    console.log('client connected', socket.id);

    // Event for a client to join a specific group/room
    socket.on('joingroup', (groupData) => {
        const { username, groupname, key, owner, color } = groupData;
        const newuser = {
            username: username,
            groupname: groupname,
            key: key,
            owner: owner,
            id: socket.id,
        };

        if (owner === true) {
            connected_owners = connected_owners.filter(
                (users) => !(users.username === username && users.groupname === groupname)
            );
            socket.join(groupname);
            connected_owners.push(newuser);
            socketIo.to(socket.id).emit('youjsutjoined', { group: groupname, owner: username });
        } else {
            const verify_grpKey = connected_owners.find(
                user => user.groupname == groupname && user.key == key
            );

            if (verify_grpKey != undefined) {
                console.log(username, socket.id);
                socket.join(groupname);
                socketIo.to(socket.id).emit('youjsutjoined', { group: groupname, owner: verify_grpKey.username });

                // 1. Immediately send the last cached document state to the newly joined user
                if (group_docs[groupname]) {
                    socketIo.to(socket.id).emit('receive_message', {
                        username: verify_grpKey.username,
                        msg: group_docs[groupname],
                        owner: true
                    });
                }

                // 2. Ask the owner to broadcast their current live editor state
                socketIo.to(verify_grpKey.id).emit('request_sync', {
                    requesterId: socket.id,
                    groupname: groupname
                });
            }
        }
        console.log(`Client ${socket.id}`, "groupdata", groupname);
    });

    // Event for receiving a message from a client for a specific group
    socket.on('sendGroupMessage', (data) => {
        const { username, groupname, msg, owner } = data;
        if (owner) {
            // Cache the owner's latest document state for future joiners
            group_docs[groupname] = msg;
        }
        socketIo.to(groupname).emit('receive_message', { username: username, msg: msg, owner: owner });
    });

    socket.on("sendchanges_masters", (data) => {
        const { username, groupname, msg, owner, color } = data;
        if (!owner) {
            const owner_send = connected_owners.find(owna => owna.groupname == groupname);
            if (owner_send) {
                idcount = idcount + 1;
                console.log("gotten changes", idcount);
                socketIo.to(owner_send.id).emit('recieve_editted', {
                    username: username,
                    msg: msg,
                    owner: owner,
                    color: color,
                    id: idcount
                });
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const owner = connected_owners.find(user => user.id === socket.id);

        if (owner != undefined) {
            connected_owners = connected_owners.filter(users => users.id != owner.id);
        }
        console.log('Client disconnected');
    });
});

// Start the server listening on the defined port
server.listen(8000, () => {
    console.log(`Server running on http://localhost:8000`);
});