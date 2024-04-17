const fs = require( "fs" );
const TelegramBot = require('node-telegram-bot-api');
const {randomInt, isNumber, isValidChat, isValidUser, getUnixTime} = require( global.directory + "/api/utils.js" )
var RM = require("../api/rolesManager.js");

/**
 * @typedef {import("node-telegram-bot-api")} TelegramBot
 */

function getDatabase(config) {

    //config database directory here
    var dbInnerDir = global.directory;
    var dir = dbInnerDir + "/database";
    var chatsDir = dbInnerDir + "/database/chats";
    var usersDir = dbInnerDir + "/database/users";

    console.log( "Generating folder tree (if not already)..." )
    var dbInnerDirFiles = fs.readdirSync( dbInnerDir );
    if ( !dbInnerDirFiles.includes( "database" ) ){

        fs.mkdirSync( dir );
        console.log( "Generated \"database\" folder" );

    }
    var dbDirFiles = fs.readdirSync( dir )
    if( !dbDirFiles.includes( "chats" ) )
    {

        fs.mkdirSync( chatsDir);
        console.log( "Generated \"database/chats\" folder" );

    }
    if( !dbDirFiles.includes( "users" ) )
    {

        fs.mkdirSync( usersDir);
        console.log( "Generated \"database/users\" folder" );

    }

    global.DBCHATS = {};

    //TODO: IF POSSIBLE fuse database.chats and database.users functions
    var database = {

        innerDir : dbInnerDir,//location where database folder should be placed (and/or generated)
        dir : dbInnerDir + "/database",
        chatsDir : dbInnerDir + "/database/chats",
        usersDir : dbInnerDir + "/database/users",

        chats :
        {

            /**
             * @param {TelegramBot.Chat} chat
             */
            add : function(chat){
            
                if ( !isValidChat(chat) ){

                    console.log( "breaking chats.add function, maybe you entered wrong chat object" );
                    return false;

                }

                
                chat.admins = [];
                chat.lang = config.reserveLang;
                chat.users = {};
                chat.basePerms = RM.newPerms();
                chat.roles = RM.newPremadeRolesObject();
                chat.warns = { timed:{}, limit:3, punishment:3, PTime: -1 };
                chat.rules = {};
                chat.welcome = { state:false, once:false, clean:false, joinList:[], lastWelcomeId:false, message:{} };
                chat.flood = { messages:3, time:5, punishment:1, PTime: 1800, delete:true }
                
                var chatFile = database.chatsDir + "/" + chat.id + ".json";
                console.log( "adding chat to database lang: " + chat.lang );
                fs.writeFileSync( chatFile, JSON.stringify(chat) )

                return true;
                
            },

            /**
             * @param {TelegramBot.ChatId} chatId The chat id of the user.
             */
            delete : function(chatId){

                if(global.DBCHATS.hasOwnProperty(chatId))
                    delete global.DBCHATS[chatId];

                var chatFile = database.chatsDir + "/" + chatId + ".json";
                if ( !fs.existsSync(chatFile) ){
                    
                    console.log( "breaking chats.delete function, " + chatFile + " file does not exhist" )
                    return false;

                }

                console.log( "Removing a chat from database" );
                fs.unlinkSync( chatFile );
                return true;

            },

            /**
             * @param {TelegramBot.ChatId} ChatId The user id of the user.
             */
            exhist : function(chatId){
                var now = getUnixTime();

                if(global.DBCHATS.hasOwnProperty(chatId))
                {
                    global.DBCHATS[chatId].lastUse = now;
                    return true;
                }

                var chatsFile = database.chatsDir + "/" + chatId + ".json";
                if( fs.existsSync(chatsFile) )
                    return true;

                return false;

            },

            /**
             * @param {TelegramBot.ChatId} ChatId The user id of the user.
             */
            get : function(chatId){
                var now = getUnixTime();

                if(global.DBCHATS.hasOwnProperty(chatId))
                {
                    global.DBCHATS[chatId].lastUse = now;
                    return global.DBCHATS[chatId];
                }

                var chatFile = database.chatsDir + "/" + chatId + ".json";
                if( !database.chats.exhist( chatId ) ){
                    console.log( "breaking chats.get, failed to get chat data from id " + chatId )
                    return false;
                }

                var chat = JSON.parse(fs.readFileSync( chatFile, "utf-8" ));
                global.DBCHATS[chatId] = chat;
                global.DBCHATS[chatId].lastUse = now;
                return chat;
            },

            /**
             * @param {TelegramBot.Chat} chat
             */
            update : async (chat) => {
                var now = getUnixTime();
                console.log("called update")

                var oldChat = database.chats.get( chat.id ); //check if exhist and be sure to load it
                if(oldChat == false)
                {
                    console.log("the updated chat does not exhist " + chat.id);
                    return false;
                }

                //this allow the caller to edit single elements of chat (chat.id is required)
                if(chat.hasOwnProperty("title")) global.DBCHATS[chat.id].title = chat.title;
                if(chat.hasOwnProperty("type")) global.DBCHATS[chat.id].type = chat.type;
                if(chat.hasOwnProperty("admins")) global.DBCHATS[chat.id].admins = chat.admins;
                if(chat.hasOwnProperty("lang")) global.DBCHATS[chat.id].lang = chat.lang;
                if(chat.hasOwnProperty("users")) global.DBCHATS[chat.id].users = chat.users;
                if(chat.hasOwnProperty("basePerms")) global.DBCHATS[chat.id].basePerms = chat.basePerms;
                if(chat.hasOwnProperty("roles")) global.DBCHATS[chat.id].roles = chat.roles;
                if(chat.hasOwnProperty("warns")) global.DBCHATS[chat.id].warns = chat.warns;
                if(chat.hasOwnProperty("rules")) global.DBCHATS[chat.id].rules = chat.rules;
                if(chat.hasOwnProperty("welcome")) global.DBCHATS[chat.id].welcome = chat.welcome;
                if(chat.hasOwnProperty("flood")) global.DBCHATS[chat.id].flood = chat.flood;

                global.DBCHATS[chat.id].lastUse = now;

                return true;

            },

            //write on disk
            /**
             * @param {TelegramBot.ChatId} ChatId The user id of the user.
             */
            save : function (chatId)
            {
                if(!global.DBCHATS.hasOwnProperty(chatId)) return false;
                var chatFile = database.chatsDir + "/" + chatId + ".json";
                console.log( "saving chat to database, id:" + chatId );
                var lastUse = global.DBCHATS[chatId].lastUse; 
                delete global.DBCHATS[chatId].lastUse;
                fs.writeFileSync( chatFile, JSON.stringify(global.DBCHATS[chatId]) )
                global.DBCHATS[chatId].lastUse = lastUse
                return true;
            },

        },
        
        users :
        {

            /**
             * @param {TelegramBot.User} user
             */
            add : function(user){

                if( !isValidUser(user) ){

                    console.log( "breaking users.add function, maybe you entered wrong user object" );
                    return false;

                }

                //TODO (maybe) : create dedicated function to initialize the custom user object (so db.user.add will only use that to write to disk)
                //prepare object with all bot needed info// TODO: add to documentation all additional infos of users

                user.waitingReply = false;
                user.waitingReplyType = "";
                user.lang = "en_en";
                if( user.language_code == "en" ){

                    user.lang = "en_en"

                }//for other langs extend with if else

                //preparing object finish here//

                var userFile = database.usersDir + "/" + user.id + ".json";
                console.log( "adding user to database lang:" + user.lang );
                fs.writeFileSync( userFile, JSON.stringify(user) );
                return true;


            },
            /**
             * @param {TelegramBot.User} user
             */
            update : function(user){

                if( !isValidUser(user) ){

                    console.log( "breaking users.update function, maybe you entered wrong user object" );
                    return false;

                }

                var oldUser = database.users.get( user.id );
                var newUser = oldUser;

                if( user.hasOwnProperty("lang") ) newUser.lang = user.lang;
                if( user.hasOwnProperty("premium") ) newUser.premium = user.premium;
                if( user.hasOwnProperty("waitingReply") ) newUser.waitingReply = user.waitingReply;
                if( user.hasOwnProperty("waitingReplyType") ) newUser.waitingReplyType = user.waitingReplyType;


                var userFile = database.usersDir + "/" + user.id + ".json";
                console.log( "updating user to database lang:" + user.lang );
                fs.writeFileSync( userFile, JSON.stringify(newUser) );
                return true;

            },

            /**
             * @param {Number|String} userId The user id of the user.
             */
            delete : function(userId){

                var userFile = database.usersDir + "/" + userId + ".json";
                if ( !fs.existsSync(userFile) ){

                    console.log( "breaking chats.delete function, " + chatFile + " file does not exhist" )
                    return false;

                }

                console.log( "Removing a chat from database" );
                fs.unlinkSync( userFile );
                return true;

            },

            /**
             * @param {Number|String} userId The user id of the user.
             */
            exhist : function(userId){

                var userFile = database.usersDir + "/" + userId + ".json";
                if( fs.existsSync(userFile) ){

                    return true;

                };
                return false;

            },

            /**
             * @param {Number|String} userId The user id of the user.
             */
            get : function(userId){

                var userFile = database.usersDir + "/" + userId + ".json";
                if( !database.users.exhist( userId ) ){

                    console.log( "breaking user.get, failed to get user data from id " + userId )
                    return false;

                }
                return JSON.parse( fs.readFileSync( userFile, "utf-8" ) );
            }

        },

        unload : function ()
        {
            var ids = Object.keys(global.DBCHATS);
            console.log("unloading " + ids.length + " chats");
            console.log(ids)
            ids.forEach((id)=>{
                database.chats.save(id);
                delete global.DBCHATS[id];
            })
        }

    }

    //save on disk every chat (preventing case of uncontrolled crash)
    setInterval( () => {
        var ids = Object.keys(global.DBCHATS);
        ids.forEach((id)=>{
            database.chats.save(id);
        })
    }, config.saveDatabaseSeconds*1000)

    //that's for keep most used chats loaded and allowing database functions spamming
    //this is a clean up for inactive chats to prevent ram from blowing up
    var cleanerIntervalTime = 60000; //milliseconds
    var unloadAfter = 60; //seconds
    setInterval( () => {
        var ids = Object.keys(global.DBCHATS);
        var now = getUnixTime();
        ids.forEach((id)=>{
            var chat = global.DBCHATS[id];
            //console.log(now + " - " + chat.lastUse + " = " + (now - chat.lastUse) + " > " + unloadAfter)
            if( (now - chat.lastUse) > unloadAfter ) 
            {
                console.log("unloading " + id);
                database.chats.save(id);
                delete global.DBCHATS[id];
            }
        })
    }, cleanerIntervalTime )

    return database;


}
module.exports = getDatabase;
