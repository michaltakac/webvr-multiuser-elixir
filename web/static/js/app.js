// Brunch automatically concatenates all files in your
// watched paths. Those paths can be configured at
// config.paths.watched in "brunch-config.js".
//
// However, those files will only be executed if
// explicitly imported. The only exception are files
// in vendor, which are never wrapped in imports and
// therefore are always executed.

// Import dependencies
//
// If you no longer want to use a dependency, remember
// to also remove its path from "config.paths.watched".
//import AFRAME from 'aframe';
import "phoenix_html"
import {Socket, Presence} from "phoenix"
import uuid from 'uuid'

var userId = uuid();

let socket = new Socket("/socket", {
  params: {user: userId},
  //logger: ((kind, msg, data) => { console.log(`${kind}: ${msg}`, data) })
});

let formatTimestamp = (timestamp) => {
  let date = new Date(timestamp)
  return date.toLocaleTimeString()
}
let listBy = (user, {metas: metas}) => {
  return {
    user: user,
    onlineAt: formatTimestamp(metas[0].online_at)
  }
}

socket.connect()

let channel = socket.channel("room:lobby", {})

/*const removeOnDisconnect = (leave) => {
  console.log("thaa cojeeeeee");
  console.log(leave);
}

channel.on("presence_state", state => {
  console.log(state);
  presences = Presence.syncState(presences, state)
  render(presences)
})

channel.on("presence_diff", diff => {
  console.log(diff.leaves);
  presences = Presence.syncDiff(presences, diff)
  console.log(presences);
  render(presences)
})*/

channel.join().receive("ignore", () => console.log("auth error"))
              .receive("ok", (resp) => console.log("join ok", resp))
              //.after(10000, () => console.log("Connection interruption"))

var getComponentProperty = AFRAME.utils.entity.getComponentProperty;
var setComponentProperty = AFRAME.utils.entity.setComponentProperty;
setTimeout(function() {
  console.log(channel);
  channel.on("leave", { reason: "bye" });
  console.log("idchadzame");
}, 5000);
function SocketWrapper () { }

SocketWrapper.prototype.init = function () {
  this.database = {};
  this.presences = {};
}

SocketWrapper.prototype.getAllEntities = function () {
  console.log(this);
  let presences = this.presences;
  var database = this.database;
  return new Promise(function (resolve) {
    channel.on("presence_state", state => {
      presences = Presence.syncState(presences, state)
      resolve(presences);
    })
  });
};

SocketWrapper.prototype.handleEntityAdded = cb => {
  channel.on("add_entity", payload => {
    cb(payload.id, payload.data);
  })
};

SocketWrapper.prototype.handleEntityChanged = cb => {
    channel.on("update_entity", payload => {
        cb(payload.id, payload.data);
    })
};

SocketWrapper.prototype.onEntityRemoved = function (handler) {
  let presences = this.presences;
  channel.on("presence_diff", diff => {
    console.log("leaving:");
    console.log(diff);
    presences = Presence.syncDiff(presences, diff)
    console.log(presences);
    handler(presences)
  })
};

/**
 * Broadcast.
 */
AFRAME.registerComponent('mathworldbroadcast', {
  schema: {
    id: {default: ''},
    userid: {default: ''},
    components: {default: ['position', 'rotation']},
    componentsOnce: {default: [], type: 'array'}
  },

  init: function (oldData) {
    var data = this.data;
    var el = this.el;
    var system = el.sceneEl.systems.mathworld;

    if (data.components.length) {
      system.registerBroadcast(el);
    }
  }
});

AFRAME.registerSystem('mathworld', {
    init() {
        console.log(this);
        this.broadcastingEntities = {};
        this.entities = {};
        this.interval = 1000;

        this.userId = userId;

        var socketWrapper = this.socketWrapper = new SocketWrapper();
        socketWrapper.init();
        this.database = socketWrapper.database;
        this.presences = socketWrapper.presences;
        socketWrapper.getAllEntities().then(this.handleInitialSync.bind(this));
        socketWrapper.handleEntityAdded(this.handleEntityAdded.bind(this));
        socketWrapper.handleEntityChanged(this.handleEntityChanged.bind(this));
        socketWrapper.onEntityRemoved(this.handleEntityRemoved.bind(this));
    },

    handleInitialSync(state) {
      let database = this.database;
      let self = this;
      let broadcastingEntities = this.broadcastingEntities;

      console.log(state);
  
      Object.keys(state).forEach(function (presenceId) {
        const entitiesInPresence = state[presenceId].metas[0].data;
        console.log(state[presenceId]);
        console.log(entitiesInPresence);
        if (entitiesInPresence) {
          Object.keys(entitiesInPresence).forEach(function (entityId) {
            if (entityId !== userId) {
              database[entityId] = entitiesInPresence[entityId];
              self.handleEntityAdded(entityId, entitiesInPresence[entityId]);
              console.log(database);
            }
          });
        }
      });
    },

    /**
     * Entity added.
     */
    handleEntityAdded: function (id, data) {
        // Already added.
        if (this.entities[id] || this.broadcastingEntities[id]) { return; }
        console.log(id);

        // Create and reference entity.
        // var entity = document.createElement('a-entity');
        // entity.setAttribute('mixin', 'avatar-head')
        // this.entities[id] = entity;
        // // Components.
        // Object.keys(initialData).forEach(function setComponent (componentName) {
        //     console.log(componentName);
        //     console.log(initialData[componentName]);
        //     setComponentProperty(entity, componentName, initialData[componentName]);
        // });

        // document.querySelector('a-scene').appendChild(entity);
        // this.database[id] = initialData;
        
        console.log(data);
        // Handle parent-child relationships.
        var parentId = data.parentId;
        var parentEl = this.sceneEl;
        if (parentId) {
          parentEl = this.entities[parentId] || this.sceneEl.querySelector('#' + parentId);
          if (!parentEl) {
            // Wait for parent to attach. (TODO: use Promises).
            var self = this;
            return setTimeout(function () {
              self.handleEntityAdded(id, data);
            });
          }
        }
        delete data.parentId;

        // Create and reference entity.
        var entity = document.createElement('a-entity');
        this.entities[id] = entity;
        console.log(this.entities[id]);
        console.log(data);
        // Components.
        Object.keys(data).forEach(function setComponent (componentName) {
            console.log(componentName);
            console.log(data[componentName]);
          setComponentProperty(entity, componentName, data[componentName]);
        });

        parentEl.appendChild(entity);
    },
    /**
   * Entity updated.
   */
  handleEntityChanged: function (id, components) {
    // Don't sync if already broadcasting to self-updating loops.
    if (this.broadcastingEntities[id]) { return; }
    console.log(components);
    var entity = this.entities[id];
    Object.keys(components).forEach(function setComponent (componentName) {
      console.log(componentName);
      if (componentName === 'parentId') { return; }
      setComponentProperty(entity, componentName, components[componentName]);
    });
  },

  /**
   * Entity removed. Detach.
   */
  handleEntityRemoved: function (entitiesLeft) {
    const userid = this.userId;
    console.log(userid);
    Object.keys(entitiesLeft)
    console.log(Object.keys(entitiesLeft).indexOf(userid) === -1);
    if (Object.keys(entitiesLeft).indexOf(userid) === -1) { return; }
    console.log("odchadzam, moj id je: ");
    console.log(document.querySelectorAll(`a-entity`));
    /*var entity = this.entities[id];
    if (!entity) { return; }
    entity.parentNode.removeChild(entity);
    delete this.entities[id];*/
  },

  /**
   * Register.
   */
  registerBroadcast: function (el) {
    var broadcastingEntities = this.broadcastingEntities;

    // Initialize entry.
    var id = uuid();
    var userid = this.userId;
    console.log(id);
    setTimeout(function () {
      broadcastingEntities[id] = el;
      el.setAttribute('mathworldbroadcast', 'id', id);
      el.setAttribute('mathworldbroadcast', 'userid', userid);
      //console.log(el.getAttribute('mathworldbroadcast'));
      //console.log(el.object3D);
      channel.push("add_entity", {id: id, data: el.getAttribute('mathworldbroadcast')})
    });

    // Remove entry when client disconnects.
    //this.socketWrapper.removeEntityOnDisconnect(id);
  },

  /**
   * Broadcast.
   */
  tick: function (time) {
    if (!this.socketWrapper) { return; }
    const self = this;
    var broadcastingEntities = this.broadcastingEntities;
    var socketWrapper = this.socketWrapper;
    var sceneEl = this.sceneEl;
  
    if (time - this.time < this.interval) { return; }
    this.time = time;

    Object.keys(broadcastingEntities).forEach(function broadcast (id) {
      var el = broadcastingEntities[id];
      var components = el.getAttribute('mathworldbroadcast').components;
      var data = {};

      // Add components to broadcast once.
      if (!el.socketBroadcastOnce && el.getAttribute('mathworldbroadcast').componentsOnce) {
        components = components.concat(el.getAttribute('mathworldbroadcast').componentsOnce);
        el.socketBroadcastOnce = true;
      }

      // Parent.
      if (el.parentNode !== sceneEl) {
        var broadcastData = el.parentNode.getAttribute('mathworldbroadcast');
        if (!broadcastData) { return; }  // Wait for parent to initialize.
        data.parentId = broadcastData.id;
      }

      data.userid = self.userId;

      // Build data.
      components.forEach(function getData (componentName) {
        data[componentName] = getComponentProperty(el, componentName, '|');
      });

      // Update entry.
      self.database[id] = data;
      channel.push("update_entity", {id: id, data: data})
    });
    //console.log(self.database);
    channel.push("update_presence", {data: self.database})
  }
});

var firebase = require('firebase');
var parse = require('url-parse');

var channelQueryParam = parse(location.href, true).query['aframe-firebase-channel'];

function FirebaseWrapper () { }

FirebaseWrapper.prototype.init = function (config) {
  this.channel = channelQueryParam || config.channel || 'default';
  this.firebase = firebase.initializeApp(config);
  this.database = firebase.database().ref(this.channel);
};

FirebaseWrapper.prototype.getAllEntities = function () {
  var database = this.database;
  return new Promise(function (resolve) {
    database.child('entities').once('value', function (snapshot) {
        console.log(snapshot.val());
      resolve(snapshot.val() || {});
    });
  });
};

FirebaseWrapper.prototype.onEntityAdded = function (handler) {
  this.database.child('entities').on('child_added', function (data) {
      console.log(data.key);
      console.log(data.val());
    handler(data.key, data.val());
  });
};

FirebaseWrapper.prototype.onEntityChanged = function (handler) {
  this.database.child('entities').on('child_changed', function (data) {
    handler(data.key, data.val());
  });
};

FirebaseWrapper.prototype.onEntityRemoved = function (handler) {
  this.database.child('entities').on('child_removed', function (data) {
    handler(data.key);
  });
};

FirebaseWrapper.prototype.removeEntityOnDisconnect = function (id) {
  this.database.child('entities').child(id).onDisconnect().remove();
};

FirebaseWrapper.prototype.createEntity = function () {
  return this.database.child('entities').push().key;
};

FirebaseWrapper.prototype.updateEntity = function (id, data) {
  this.database.child('entities/' + id).update(data);
};


/**
 * Firebase system.
 */
AFRAME.registerSystem('firebase', {
  schema: {
    apiKey: {type: 'string'},
    authDomain: {type: 'string'},
    channel: {type: 'string'},
    databaseURL: {type: 'string'},
    interval: {type: 'number'},
    storageBucket: {type: 'string'}
  },

  init: function () {
    // Get config.
    var config = this.data;

    // TODO: https://github.com/aframevr/aframe/pull/1670
    if (!config.apiKey && !window.debug) { return; }

    this.broadcastingEntities = {};
    this.entities = {};
    this.interval = config.interval || 1000;

    // Set up Firebase.
    var firebaseWrapper = this.firebaseWrapper = new FirebaseWrapper();
    firebaseWrapper.init(config);
    this.firebase = firebaseWrapper.firebase;
    this.database = firebaseWrapper.database;
    firebaseWrapper.getAllEntities().then(this.handleInitialSync.bind(this));
    firebaseWrapper.onEntityAdded(this.handleEntityAdded.bind(this));
    firebaseWrapper.onEntityChanged(this.handleEntityChanged.bind(this));
    firebaseWrapper.onEntityRemoved(this.handleEntityRemoved.bind(this));
  },

  /**
   * Initial sync.
   */
  handleInitialSync: function (data) {
    console.log(data);
    var self = this;
    var broadcastingEntities = this.broadcastingEntities;
    console.log(broadcastingEntities);
    Object.keys(data).forEach(function (entityId) {
      console.log(data);
      self.handleEntityAdded(entityId, data[entityId]);
    });
  },

  /**
   * Entity added.
   */
  handleEntityAdded: function (id, data) {
    // Already added.
    if (this.entities[id] || this.broadcastingEntities[id]) { return; }
    console.log(data);
    // Handle parent-child relationships.
    var parentId = data.parentId;
    var parentEl = this.sceneEl;
    if (parentId) {
      parentEl = this.entities[parentId] || this.sceneEl.querySelector('#' + parentId);
      if (!parentEl) {
        // Wait for parent to attach. (TODO: use Promises).
        var self = this;
        return setTimeout(function () {
          self.handleEntityAdded(id, data);
        });
      }
    }
    delete data.parentId;

    // Create and reference entity.
    var entity = document.createElement('a-entity');
    this.entities[id] = entity;
    console.log(this.entities[id]);
    console.log(data);
    // Components.
    Object.keys(data).forEach(function setComponent (componentName) {
        console.log(componentName);
      setComponentProperty(entity, componentName, data[componentName]);
    });

    parentEl.appendChild(entity);
  },

  /**
   * Entity updated.
   */
  handleEntityChanged: function (id, components) {
    // Don't sync if already broadcasting to self-updating loops.
    if (this.broadcastingEntities[id]) { return; }
    console.log(components);
    var entity = this.entities[id];
    Object.keys(components).forEach(function setComponent (componentName) {
      if (componentName === 'parentId') { return; }
      setComponentProperty(entity, componentName, components[componentName]);
    });
  },

  /**
   * Entity removed. Detach.
   */
  handleEntityRemoved: function (id) {
    var entity = this.entities[id];
    if (!entity) { return; }
    entity.parentNode.removeChild(entity);
    delete this.entities[id];
  },

  /**
   * Register.
   */
  registerBroadcast: function (el) {
    var broadcastingEntities = this.broadcastingEntities;

    // Initialize entry, get assigned a Firebase ID.
    var id = this.firebaseWrapper.createEntity();

    setTimeout(function () {
      broadcastingEntities[id] = el;
      el.setAttribute('firebase-broadcast', 'id', id);
      console.log(el.getAttribute('firebase-broadcast'));
    });

    // Remove entry when client disconnects.
    this.firebaseWrapper.removeEntityOnDisconnect(id);
  },

  /**
   * Broadcast.
   */
  tick: function (time) {
    if (!this.firebase) { return; }

    var broadcastingEntities = this.broadcastingEntities;
    var firebaseWrapper = this.firebaseWrapper;
    var sceneEl = this.sceneEl;

    if (time - this.time < this.interval) { return; }
    this.time = time;

    Object.keys(broadcastingEntities).forEach(function broadcast (id) {
      var el = broadcastingEntities[id];
      var components = el.getAttribute('firebase-broadcast').components;
      var data = {};

      // Add components to broadcast once.
      if (!el.firebaseBroadcastOnce && el.getAttribute('firebase-broadcast').componentsOnce) {
        components = components.concat(el.getAttribute('firebase-broadcast').componentsOnce);
        el.firebaseBroadcastOnce = true;
      }

      // Parent.
      if (el.parentNode !== sceneEl) {
        var broadcastData = el.parentNode.getAttribute('firebase-broadcast');
        if (!broadcastData) { return; }  // Wait for parent to initialize.
        data.parentId = broadcastData.id;
      }

      // Build data.
      components.forEach(function getData (componentName) {
        data[componentName] = getComponentProperty(el, componentName, '|');
      });

      // Update entry.
      firebaseWrapper.updateEntity(id, data);
    });
  }
});

/**
 * Broadcast.
 */
AFRAME.registerComponent('firebase-broadcast', {
  schema: {
    id: {default: ''},
    components: {default: ['position', 'rotation']},
    componentsOnce: {default: [], type: 'array'}
  },

  init: function (oldData) {
    var data = this.data;
    var el = this.el;
    var system = el.sceneEl.systems.firebase;

    if (data.components.length) {
      system.registerBroadcast(el);
    }
  }
});



AFRAME.registerComponent('follow', {
  schema: {type: 'selector'},

  init: function () {
    var el = this.el;
    this.data.addEventListener('componentchanged', function (evt) {
      if (evt.detail.name !== 'position') { return; }
      el.setAttribute('position', evt.detail.newData);
    });
  }
});
