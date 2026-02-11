let storedata = [];
let listeners=[];
let store_=[];

export const SubcribeToStore = {
  addData : (data)=>{
      storedata[0] = [data]
      console.log(storedata)
      emitChange()
  },
  addmesg : (data)=>{
      storedata[1] = data
      console.log(storedata)
      emitChange()
  },
  addeditdata : (data)=>{
    storedata[2] = data
    console.log(storedata)
    emitChange()
  },
  RemoveEditData:()=>{
    storedata[2]=[]
  },
  suggestion:(data)=>{
    store_.push(data)
  },
  removsuggest:()=>{
    store_=[]
  },
  RevaddData : (data)=>{
    storedata = storedata.filter((list)=> list != data)
    emitChange()
  },
  subscribe :(listener)=> {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
    /**
     * another simple example to show users when they are online or offline
        window.addEventListener('online', callback);
        window.addEventListener('offline', callback);
        return () => {
          window.removeEventListener('online', callback);
          window.removeEventListener('offline', callback);
     */
  },

  getSnapshot:()=> {
    return storedata;
    // return navigator.onLine;
  }, 

  getView:()=> {
    return storedata[1];
    // return navigator.onLine;
  },

  getData:()=> {
    return storedata[2];
    // return navigator.onLine;
  },
  getSuggest:()=>{
    console.log(store_)
    return store_;
  }
}

function emitChange() {
  for (let listener of listeners) {
    listener();
  }
}