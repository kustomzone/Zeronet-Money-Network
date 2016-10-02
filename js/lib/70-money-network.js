// Money-C1 - 1=could by one of many different Money network client implementations.

// fix missing Array.indexOf in IE8
// http://stackoverflow.com/questions/3629183/why-doesnt-indexof-work-on-an-array-ie8
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (elt /*, from*/) {
        var len = this.length >>> 0;

        var from = Number(arguments[1]) || 0;
        from = (from < 0)
            ? Math.ceil(from)
            : Math.floor(from);
        if (from < 0)
            from += len;

        for (; from < len; from++) {
            if (from in this &&
                this[from] === elt)
                return from;
        }
        return -1;
    };
}


// helper functions
var MoneyNetworkHelper = (function () {

    var module = 'MoneyNetworkHelper' ;

    // local or session storage functions ==>

    // sessionStorage and localStorage implementation. direct calls are not working in ZeroNet. Error: The operation is insecure
    // sessionStorage is implemented as a JS object
    // localStorage is implemented as a JS object stored and updates sync asynchronously in ZeroFrame API

    // sessionStorage.
    var session_storage = {} ;

    // localStorage javascript copy is loaded from ZeroFrame API. Initialized asyn. Takes a moment before JS local_storage copy is ready
    var local_storage = { loading: true } ;
    var local_storage_functions = [] ; // functions waiting for localStorage to be ready. see authCtrl.set_register_yn
    function local_storage_bind(f) {
        if (local_storage.loading) local_storage_functions.push(f);
        else f() ;
    }
    ZeroFrame.cmd("wrapperGetLocalStorage", [], function (res) {
        var pgm = module + '.wrapperGetLocalStorage callback (1): ';
        // console.log(pgm + 'typeof res =' + typeof res) ;
        // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
        if (!res) res = [{}] ;
        res = res[0];
        // moving values received from ZeroFrame API to JS copy of local storage
        // console.log(pgm + 'old local_storage = ' + JSON.stringify(local_storage)) ;
        // console.log(pgm + 'moving values received from ZeroFrame API to JS local_storage copy');
        var key ;
        for (key in local_storage) if (!res.hasOwnProperty(key)) delete local_storage[key] ;
        for (key in res) local_storage[key] = res[key] ;
        // console.log(pgm + 'local_storage = ' + JSON.stringify(local_storage));
        // execute any function waiting for localStorage to be ready
        for (var i=0 ; i<local_storage_functions.length ; i++) {
            var f = local_storage_functions[i] ;
            f();
        }
        local_storage_functions.length = 0 ;
    }) ;

    // write JS copy of local storage back to ZeroFrame API
    function local_storage_save() {
        var pgm = module + '.local_storage_save: ' ;
        // console.log(pgm + 'calling wrapperSetLocalStorage');
        ZeroFrame.cmd("wrapperSetLocalStorage", [local_storage], function () {
            var pgm = module + '.local_storage_save wrapperSetLocalStorage callback: ';
            // console.log(pgm + 'OK');
        }) ;
    } // local_storage_save


    // convert data.json to newest version. compare dbschema.schema_changed and data.version.
    function zeronet_migrate_data (json) {
        var pgm = module + '.zeronet_migrate_data: ' ;
        if (!json.version) json.version = 1 ;
        var dbschema_version = 2 ;
        if (json.version == dbschema_version) return ;
        var i ;
        // data.json version 1
        // missing multiple users support. there are following problems in version 1:
        //   a) there can be multiple user accounts in a client
        //   b) one client can connect to other ZeroNet accounts
        //   c) one ZeroNet user can use multiple devices
        //{ "sha256": "5874fe64f6cb50d2410b7d9e1031d4403531d796a70968a3eabceb71721af0fc",
        //  "pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQB5lpAS1uVBKhoo/W3Aas17\nns/VXuaIrAQfvAF30yCH+j5+MoyqMib9M0b6mWlLFnSvk/zrZYUyCXf1PrtYDqtn\nsXulIYEhdKsjkAmnfSeL3CofQu8tl3fxbr1r2hj/XyWPwo3oTsamoyMaFlJLrOsl\n/+IOZswP6IdgNVNa8Xs2UDM3w9TWisCScsHJDw7i7fSJdhFVdQvlFhfhWHHdcXAz\nmBA2oQaNtbOukKS16F4WVPN5d00R13iqqL9AXEYrWs0tggYQ+KKyO2+kRLFUDj8z\nWm2BdvRgfHTqxViEa4eFf+ceukpobnZdStjdxJW9jk4Q2Iiw6CLv+CrtSiz7tMzv\nAgMBAAE=\n-----END PUBLIC KEY-----",
        //  "search": [{ "tag": "name", "value": "xxxx", "time": 1475175779840 }]
        //};
        if (json.version == 1) {
            // convert from version 1 to 2
            // add users array
            console.log(pgm + 'json version 1 = ' + JSON.stringify(json)) ;
            json.users = [{ user_seq: 1, sha256: json.sha256, pubkey: json.pubkey}] ;
            delete json.sha256 ;
            delete json.pubkey ;
            // add user_seq to search array
            if (!json.search) json.search = [] ;
            for (i=0 ; i<json.search.length ; i++) json.search[i].user_seq = 1 ;
            json.version = 2 ;
        }
        // data.json version 2. minor problems:
        // a) should move time from search array to users array (timestamp for last update)
        // b) should remove users without search words
        // { "search": [
        //     {"user_seq": 3, "tag": "Name", "value": "xxx", "time": 1475318394228},
        //     {"user_seq": 4, "tag": "Name", "value": "xxx", "time": 1475318987160} ],
        //   "version": 2,
        //   "users": [
        //     {"user_seq": 1, "sha256": "97526f811cd0e93cfa77d9558a367238132bf5f8966c93fc88931eac574d6980", "pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnwCwB9wCrtZK6QoTXj4D\nQelvBWqay0l07yqKF1NBh7Hr2PNmxy2OuTGyQp8KtdL8IwqNGFyiU72ig6zHoSgA\nsmWoPcwG3XLOvzb2o4LC9dY5E0KrW+wMoiRWNloVriKavUF4FwNeTCN5Q3o0+g2W\nHvSPq8Oz06d11BUtDJ88eVu+TeHC+Wk/JYXdcOnQf9cxM+wZSrDvTLXoyjtsFxWe\nUV3lE03Xss2SSOCggR5tmht9G6D68JB0rOKe6VcQ0tbHO292P0EMNOydcoJn0Edw\nzAdFo/XkQLXC/Cl4XDuE/RD1qH+1O7C4Bs9eG2EBdgmzvM5HqbvmvvYZzUDBgFuZ\nmQIDAQAB\n-----END PUBLIC KEY-----"},
        //     {"user_seq": 2, "sha256": "8bec70849d1531948c12001f11a928862732e661fbf0708aa404d94eeaab99bf", "pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr2OsRJv06+Iap7YfFAtk\nzSmkDNPyN6fNcKJuSmPLRa2p4kh4WhHrJLuqua9jD42MkH3BkD3qcDhYqaGZvH9i\nPxxg8uYdl+XZuTsUfjTnWaaQODX/9Dgy75Ow+0H5DbmJKTAESREiqwegNkXyYuje\nN2UhXiLFaDsXz8OXgKOEBFei5r/EXcRKTCytglubuu7skxLrV/AQ8a+/+JcwI4a7\n3ezaSjeopHiglZi2h8U1wPuAopvjh+B107WctGV1iUv0I8yzbaUgkllTouL1hrr3\n1tR4TYMTuoReT+l+dqPyOKjKDai02Fb9ZZydtNmF2R33uFp4gPLTUoAwh7r//SW/\njwIDAQAB\n-----END PUBLIC KEY-----"},
        //     {"user_seq": 3, "sha256": "94a4f3887315a7bb01d836ecb6e15502c707865ff108b47ea05fa7bced794f3e", "pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqK1lnagsPFXalq9vlL5K\nqqlWBffQYUGptJH7DlLsRff+tc2W62yEQ9+ibBkerZdwrRWsG/thN0lWxeLxTuw5\nmmuF4eLsKoubH/tQJF3XrhOoUn4M7tVtGwL5aN/BG1W22l2F+Rb8Q7Tjtf3Rqdw/\nSk46CWnEZ2x1lEcj9Gl+7q7oSLocjKWURaC61zJbBmYO4Aet+/MktN0gW1VEjpPU\nr1/yEhX5EfDNwDNgOUN43aIJkv5+WcgkiGZf56ZqEauwoKsg9xB2c8v6LTv8DZlj\n+OJ/L99sVXP+QzA2yO/EQIbaCNa3Gu35GynZPoH/ig2yx0BMPu7+4/QLiIqAT4co\n+QIDAQAB\n-----END PUBLIC KEY-----"},
        //     {"user_seq": 4, "sha256": "0f5454007ceee575e63b52058768ff1bc0f1cb79b883d0dcf6a920426836c2c7", "pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiANtVIyOC+MIeEhnkVfS\nn/CBDt0GWCba4U6EeUDbvf+HQGfY61e9cU+XMbI8sX7b9R5G7T+zdVqbmEIZwNEb\nDn9NIs4PVA/xqemrQUrm3qEHK8iq/+5CUwVeKeb6879FgPL8fSj1E3nNQPnmuh8N\nE+/04PraakAj9A6Z1OE5m+sfC59IDwYTKupB53kX3ZzHMmWtdYYEr08Zq9XHuYMM\nA4ykOqENGvquGjPnTB4ASKfRTLCUC+TsG5Pd+2ZswxxU3zG5v/dczj+l3GKaaxP7\nxEqA8nFYiU7LiA1MUzQlQDYj/t7ckRdjGH51GvZxlGFFaGQv3yqzs7WddZg8sqMM\nUQIDAQAB\n-----END PUBLIC KEY-----"}
        //   ]
        // }
        if (json.version == 2) {
            // convert from version 2 to 3
        }
        if (json.version == 3) {
            // convert from version 3 to 4
        }
        if (json.version == 4) {
            // convert from version 4 to 5
        }
        if (json.version == 5) {
            // convert from version 5 to 6
        }
        // etc
        console.log(pgm + 'json version ' + json.version + ' = ' + JSON.stringify(json)) ;

        return ;
    } // zeronet_migrate_data


    // update user_info (search words) on ZeroNet
    function zeronet_update_user_info () {
        var pgm = module + '. zeronet_update_user_info: ';

        // check if auto generate cert + login in ZeroFrame was OK
        console.log(pgm + 'site_info = ' + JSON.stringify(ZeroFrame.site_info)) ;
        if (!ZeroFrame.site_info.cert_user_id) {
            ZeroFrame.cmd("wrapperNotification", ["error", "Ups. Something is wrong. Not logged in on ZeroNet. Cannot post search words in Zeronet. siteInfo.cert_user_id is null", 10000]);
            console.log(pgm + 'site_info = ' + JSON.stringify(ZeroFrame.site_info));
            return ;
        }

        var user_info = getItem('user_info');
        if (!user_info) user_info = [] ;
        else user_info = JSON.parse(user_info) ;
        var pubkey = getItem('pubkey') ;
        // console.log(pgm + 'user_info = ' + JSON.stringify(user_info)) ;
        // console.log(pgm + 'pubkey = ' + pubkey);
        // console.log(pgm + 'create/update json with search words') ;
        var data_inner_path = "data/users/" + ZeroFrame.site_info.auth_address + "/data.json";
        var content_inner_path = "data/users/" + ZeroFrame.site_info.auth_address + "/content.json";

        // update json table with public key and search words
        // console.log(pgm + 'calling fileGet: inner_path = ' + data_inner_path + ', required = false');
        ZeroFrame.cmd("fileGet", {inner_path: data_inner_path, required: false}, function (data) {
            var pgm = module + '.zeronet_update_user_info fileGet callback: ' ;
            // console.log(pgm + 'data = ' + JSON.stringify(data));
            var json_raw, row;
            if (data) {
                data = JSON.parse(data);
                zeronet_migrate_data(data);
            }
            else data = {
                version: 2,
                users: [],
                search: []
            };
            // find current user in users array
            var max_user_seq = 0, i, user_i, user_seq ;
            for (i=0 ; i<data.users.length ; i++) {
                if (pubkey == data.users[i].pubkey) {
                    user_i = i ;
                    user_seq = data.users[user_i].user_seq
                }
                else if (data.users[i].user_seq > max_user_seq) max_user_seq = data.users[i].user_seq ;
            }
            if (!user_seq && (user_info.length > 0)) {
                // add current user to data.users array
                user_seq = max_user_seq + 1 ;
                data.users.push({
                    user_seq: user_seq,
                    sha256: CryptoJS.SHA256(pubkey).toString(),
                    pubkey: pubkey
                }) ;
                // console.log(pgm + 'added user to data.users. data = ' + JSON.stringify(data)) ;
            }

            // remove old search words from search array
            var user_no_search_words = {} ;
            for (i=data.search.length-1 ; i>=0 ; i--) {
                row = data.search[i] ;
                if (row.user_seq == user_seq) data.search.splice(i,1);
                else {
                    if (!user_no_search_words.hasOwnProperty(row.user_seq)) user_no_search_words[row.user_seq] = 0 ;
                    user_no_search_words[row.user_seq]++ ;
                }
            }
            // console.log(pgm + 'removed old rows for user_seq ' + user_seq + ', data = ' + JSON.stringify(data));
            // add new search workds to search array
            user_no_search_words[user_seq] = 0 ;
            for (i=0 ; i<user_info.length ; i++) {
                if (user_info[i].privacy != 'Search') continue ;
                row = {
                    user_seq: user_seq,
                    tag: user_info[i].tag,
                    value: user_info[i].value,
                    time: new Date().getTime()
                };
                data.search.push(row);
                user_no_search_words[user_seq]++ ;
            } // for i
            // console.log(pgm + 'user_no_search_words = ' + JSON.stringify(user_no_search_words));
            // remove users without any search words
            // can be deleted users (clear local storage) or can be users done searching for contacts
            for (i=data.users.length-1 ; i >= 0 ; i--) {
                user_seq = data.users[i].user_seq ;
                if (!user_no_search_words.hasOwnProperty(user_seq) || (user_no_search_words[user_seq] == 0)) {
                    data.users.splice(i, 1);
                    // console.log(pgm + 'removed user ' + user_seq + ' from users array');
                }
            }
            // console.log(pgm + 'added new rows for user_seq ' + user_seq + ', data = ' + JSON.stringify(data)) ;
            json_raw = unescape(encodeURIComponent(JSON.stringify(data, null, "\t")));
            // console.log(pgm + 'calling fileWrite: inner_path = ' + data_inner_path + ', data = ' + JSON.stringify(btoa(json_raw)));
            ZeroFrame.cmd("fileWrite", [data_inner_path, btoa(json_raw)], function (res) {
                var pgm = module + '.zeronet_update_user_info fileWrite callback: ' ;
                // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                if (res === "ok") {
                    // console.log(pgm + 'calling sitePublish: inner_path = ' + content_inner_path) ;
                    ZeroFrame.cmd("sitePublish", {inner_path: content_inner_path}, function (res) {
                        var pgm = module + '.zeronet_update_user_info sitePublish callback: ' ;
                        // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        if (res != "ok") ZeroFrame.cmd("wrapperNotification", ["error", "Failed to post: " + res.error, 5000]);
                    }); // sitePublish
                } else ZeroFrame.cmd("wrapperNotification", ["error", "Failed to post: " + res.error, 5000]);
            }); // fileWrite
        }); // fileGet
    } // zeronet_update_user_info


    // search ZeroNet for potentiel contracts with matching search words
    function zeronet_search () {
        var pgm = module + '.zeronet_search: ' ;
        // find json_id and user_seq for current user.
        // must use search words for current user
        // must not return search hits for current user
        var directory = 'users/' + ZeroFrame.site_info.auth_address ;
        var pubkey = getItem('pubkey') ;
        var sha256 = CryptoJS.SHA256(pubkey).toString();
        var query = "select json.json_id, users.user_seq from json, users " +
            "where json.directory = '" + directory + "' " +
            "and users.json_id = json.json_id " +
            "and users.sha256 = '" + sha256 + "'";
        console.log(pgm + 'query 1 = ' + query) ;
        ZeroFrame.cmd("dbQuery", [query], function(res) {
            var pgm = module + '.zeronet_search dbQuery callback 1: ' ;
            console.log(pgm + 'res = ' + JSON.stringify(res)) ;
            if (res.error) {
                ZeroFrame.cmd("wrapperNotification", ["error", "Search for new contacts failed: " + res.error, 5000]);
                return ;
            }
            if (res.length == 0) {
                // current user not in data.users array. must be an user without any search words in user_info
                ZeroFrame.cmd("wrapperNotification", ["info", "No search words in user profile. Please add some search words and try again", 3000]);
                return ;
            }
            var json_id = res[0].json_id ;
            var user_seq = res[0].user_seq ;
            console.log(pgm + 'json_id = ' + json_id + ', user_seq = ' + user_seq) ;
            // find other clients with matching search words using sqlite like operator
            query =
                "select" +
                "  my_search.tag as my_tag, my_search.value as my_val," +
                "  users.pubkey as other_pubkey, substr(json.directory,7) other_auth_address," +
                "  search.tag as other_tag, search.value as other_value " +
                "from" +
                "  (select search.tag, search.value from search" +
                "   where search.json_id = " + json_id + " and search.user_seq = " + user_seq + ") as my_search," +
                "  search, users, json " +
                "where (my_search.tag like search.tag and  my_search.value like search.value " +
                "or search.tag like my_search.tag and search.value like my_search.value) " +
                "and not (search.json_id = " + json_id + " and search.user_seq = " + user_seq + ") " +
                "and users.json_id = search.json_id " +
                "and users.user_seq = search.user_seq " +
                "and json.json_id = search.json_id";
            console.log(pgm + 'query 2 = ' + query) ;
            ZeroFrame.cmd("dbQuery", [query], function(res) {
                var pgm = module + '.zeronet_search dbQuery callback 2: ';
                console.log(pgm + 'res = ' + JSON.stringify(res));
                if (res.error) {
                    ZeroFrame.cmd("wrapperNotification", ["error", "Search for new contacts failed: " + res.error, 5000]);
                    return;
                }
                if (res.length == 0) {
                    // current user not in data.users array. must be an user without any search words in user_info
                    ZeroFrame.cmd("wrapperNotification", ["info", "No new contacts were found. Please add or edit search words and try again", 3000]);
                    return;
                }
                var sha256s = [] ;
                for (var i=0 ; i<res.length ; i++) {
                    res[i].sha256 = CryptoJS.SHA256(res[i].pubkey).toString();
                    if (sha256s.indexOf(res[i].sha256)==-1) sha256s.push(res[i].sha256) ;
                }
                if (sha256s.length == 1) ZeroFrame.cmd("wrapperNotification", ["info", "1 new contact was found", 3000]);
                else ZeroFrame.cmd("wrapperNotification", ["info", sha256s.length + " new contacts was found", 3000]);
            }) ;
        }) ;




        //select my_search.tag, my_search.value, search.json_id, search.user_seq, search.tag, search.value, users.pubkey
        //from
        //(select search.tag,  search.value
        //from json,  search
        //where json.directory = 'users/1CCiJ97XHgVeJrkbnzLgfXvYRr8QEWxnWF'
        //and search.json_id = json.json_id
        //and search.user_seq = 5) as my_search,
        //    search, users
        //where my_search.value like search.value
        //and my_search.tag like search.tag
        //and not (search.json_id = 9 and search.user_seq = 5)
        //and users.json_id = search.json_id
        //and users.user_seq = search.user_seq ;

    } // zeronet_search


    // values in sessionStorage:
    // - data are discarded when user closes browser tab
    // - only userid and password keys
    // - never <userid> prefix before key
    // - values are not compressed or encrypted

    // values in localStorage:
    // - data are preserved when user closes tab or browser
    // - some values are global values without <userid> prefix. others are user specific values with <userid> prefix
    // - some values are encrypted (keys, authorization and other sensible information)
    // - encryption: key is as only item encrypted with password (human text). All other encrypted items are is encrypted with key (random string)
    // - some values are compressed (users and gifts arrays)
    // - rules (local_storage_rules) are derived from key name
    // - default values are <userid> prefix, no encryption and no compression (write warning in console.log)

    var storage_rules = {
        // basic authorization - see client_login
        key: {session: false, userid: true, compress: true, encrypt: true}, // random password - used for localStorage encryption
        password: {session: true, userid: false, compress: false, encrypt: false}, // session password in clear text
        passwords: {session: false, userid: false, compress: false, encrypt: false}, // array with hashed passwords. size = number of accounts
        prvkey: {session: false, userid: true, compress: true, encrypt: true}, // for encrypted user to user communication
        pubkey: {session: false, userid: true, compress: true, encrypt: false}, // for encrypted user to user communication
        userid: {session: true, userid: false, compress: false, encrypt: false}, // session userid (1, 2, etc) in clear text.
        // user data
        user_info: {session: false, userid: true, compress: true, encrypt: true} // array with user_info. See user sub page / userCtrl
    };

    // first character in stored value is an encryption/compression storage flag
    // storage flag makes it possible to select best compression method
    // and storage flag makes it possible to later change storage rules for already saved values
    var storage_flags = {
        a: {compress: 0, encrypt: 0, sequence: 0}, // clear text - not compressed, not encrypted
        b: {compress: 0, encrypt: 1, sequence: 0}, // encrypted only - not compressed
        c: {compress: 1, encrypt: 0, sequence: 0}, // LZString synchronous compression, not encrypted
        d: {compress: 1, encrypt: 1, sequence: 0}, // LZString synchronous compression, compress => encrypt
        e: {compress: 1, encrypt: 1, sequence: 1}, // LZString synchronous compression, encrypt => compress
        f: {compress: 2, encrypt: 0, sequence: 0}, // LZMA level 1 asynchronous compression, not encrypted
        g: {compress: 2, encrypt: 1, sequence: 0}, // LZMA level 1 asynchronous compression, compress => encrypt
        h: {compress: 2, encrypt: 1, sequence: 1}, // LZMA level 1 asynchronous compression, encrypt => compress
        i: {compress: 3, encrypt: 0, sequence: 0}, // compression 3, not encrypted (reserved / not implemented)
        j: {compress: 3, encrypt: 1, sequence: 0}, // compression 3, compress => encrypt (reserved / not implemented)
        k: {compress: 3, encrypt: 1, sequence: 1}, // compression 3, encrypt => compress (reserved / not implemented)
        l: {compress: 4, encrypt: 0, sequence: 0}, // compression 4, not encrypted (reserved / not implemented)
        m: {compress: 4, encrypt: 1, sequence: 0}, // compression 4, compress => encrypt (reserved / not implemented)
        n: {compress: 4, encrypt: 1, sequence: 1}  // compression 4, encrypt => compress (reserved / not implemented)
    };

    // reverse index - from compress*encrypt*sequence (binary 0-19) to storage flag a-n
    var storage_flag_index = {};

    function storage_options_bin_key(storage_options) {
        return 4 * storage_options.compress + 2 * storage_options.encrypt + storage_options.sequence;
    }

    (function () {
        var storage_flag; // a-n
        var index; // 0-19
        for (storage_flag in storage_flags) {
            if (storage_flags.hasOwnProperty(storage_flag)) {
                index = storage_options_bin_key(storage_flags[storage_flag]);
                storage_flag_index[index] = storage_flag;
            }
        }
    })();

    // todo: how to handle "no more space" in local storage?
    // 1) only keep newer gifts and relevant users in local storage
    //    gifts and users arrays should be saved in local storage in one operation to allow automatic space management
    //    add oldest_gift_at timestamp. Ignore gifts with timestamp before oldest_gift_id when sync. gifts with other devices
    //    or oldest_gift_id pointer. Ignore gifts with gift_id < oldest_gift_ud when sync. gifts when other devices
    // 2) a possibility is to store old blocks with gifts and users on server encrypted with pubkey
    //    that is show-more-rows functionality at end of page
    //    send a server request to get old data block. Return old data block and insert into users and gifts js arrays
    //    old data block stored on server can be changed if user info changes, friendship changes, or gifts are change or are deleted

    // symmetric encrypt sensitive data in local storage.
    // password is saved in session storage and is deleted when user closes tab in browser
    // also used for symmetric encryption in communication between clients
    function encrypt(text, password) {
        var output_wa;
        output_wa = CryptoJS.AES.encrypt(text, password, {format: CryptoJS.format.OpenSSL}); //, { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.AnsiX923, format: CryptoJS.format.OpenSSL });
        return output_wa.toString(CryptoJS.format.OpenSSL);
    }

    function decrypt(text, password) {
        var output_wa;
        output_wa = CryptoJS.AES.decrypt(text, password, {format: CryptoJS.format.OpenSSL}); // , { mode: CryptoJS.mode.CTR, padding: CryptoJS.pad.AnsiX923, format: CryptoJS.format.OpenSSL });
        return output_wa.toString(CryptoJS.enc.Utf8);
    }

    // LZString compress and decompress strings - fast and synchronous compress and decompress
    // https://github.com/pieroxy/lz-string
    // http://pieroxy.net/blog/pages/lz-string/guide.html)
    function compress1(text) {
        return LZString.compressToUTF16(text);
    }

    function decompress1(text) {
        return LZString.decompressFromUTF16(text);
    }

    // LZMA level 1 compress and decompress strings - not as fast as LZString - runs asynchronous
    // setItem uses LZString in compression. At end setItem submit a asynchronous task to check if LZMA level 1 compress is better
    // todo: LZMA disabled until I find a good method to convert byte array output from LZMA.compress into an utf-16 encoded string

    // lzma_compress0 - sequence = 0 - not encrypted or normal compress => encrypt sequence
    // lzma_compress1 - sequence = 1 - encrypted and reverse encrypt => compress sequence

    // params:
    // - key and value - original inputs to setItem
    // - session: true: sessionStorage, false: localStorage
    // - password: null: not encrypted, != null: encrypted
    // - length: length of lzstring compressed value (without storage flag)
    function lzma_compress1(key, value, session, password, length) {
        var pgm = 'lzma_compress1: ';
        value = encrypt(value, password);
        // start compress
        // var lzma = new LZMA;
        LZMA.compress(value, 1, function (value) {
            // compress result received
            console.log(pgm + 'compress result received. value = ' + value);
            if (value.length >= length) return;
            // lzma compress sequence 2 was better than lzstring compress and/or lzma compress sequence = 0 (compress => encrypt)
            console.log(pgm + 'key = ' + key + '. lzma compress sequence 2 was better than lzstring compress and/or lzma compress sequence = 0 (compress => encrypt)');
            // find storage flag and save new compressed value
            var storage_options = {compress: 2, encrypt: 1, sequence: 1};
            var bin_key = storage_options_bin_key(storage_options);
            var storage_flag = storage_flag_index[bin_key];
            if (!storage_flag) {
                console.log(pgm + 'Warning. key ' + key + ' was not optimized. Could not found storage flag for storage options = ' + JSON.stringify(storage_options));
                return;
            }
            value = storage_flag + value;
            // save
            if (session) session_storage[key] = value; // sessionStorage.setItem(key, value);
            else local_storage[key] = value ; // localStorage.setItem(key, value);
        }, null);
    } // lzma_compress1
    function lzma_compress0(key, value, session, password, length) {
        var pgm = 'lzma_compress0: ';
        var save_value = value;
        // start compress
        // var lzma = new LZMA;
        LZMA.compress(value, 1, function (value) {
            // compress result received
            console.log(pgm + 'compress result received. value = ' + value);
            if (password) value = encrypt(value, password);
            if (value.length < length) {
                // lzma compress was better than lzstring compress
                console.log(pgm + 'key = ' + key + '. lzma compress was better than lzstring compress');
                // find storage flag and save new compressed value
                var storage_options = {compress: 2, encrypt: (password ? 1 : 0), sequence: 0};
                var bin_key = storage_options_bin_key(storage_options);
                var storage_flag = storage_flag_index[bin_key];
                if (!storage_flag) {
                    console.log(pgm + 'Warning. key ' + key + ' was not optimized. Could not found storage flag for storage options = ' + JSON.stringify(storage_options));
                    return;
                }
                value = storage_flag + value;
                // save
                if (session) session_storage[key] = value; // sessionStorage.setItem(key, value);
                else local_storage[key] = value ; // localStorage.setItem(key, value);
                length = value.length - 1;
            }
            ;
            // start start_lzma_compress1 if encrypted - sequence = 1 - encrypt before compress
            if (password) lzma_compress1(key, save_value, session, password, length);
        }, null);
    } // check_lzma_compress

    // look storage rules for key. add default values and write warning to console log when using defaults
    function get_local_storage_rule(key) {
        var pgm = 'MoneyNetworkHelper.get_local_storage_rule: ';
        var key_options;
        if (storage_rules.hasOwnProperty(key)) key_options = storage_rules[key];
        else {
            console.log(pgm + 'Warning. ' + key + ' was not found in local_storage_rules hash.');
            key_options = {session: false, userid: true, compress: false, encrypt: false};
        }
        if (!key_options.hasOwnProperty('session')) {
            console.log(pgm + 'Warning. using default value session=false for key ' + key);
            key_options.session = false;
        }
        if (!key_options.hasOwnProperty('userid')) {
            key_options.userid = !key_options.session;
            console.log(pgm + 'Warning. using default value userid=' + key_options.userid + ' for key ' + key);
        }
        if (!key_options.hasOwnProperty('compress')) {
            console.log(pgm + 'Warning. using default value compress=false for key ' + key);
            key_options.compress = false;
        }
        if (!key_options.hasOwnProperty('encrypt')) {
            console.log(pgm + 'Warning. using default value encrpt=false for key ' + key);
            key_options.encrypt = false;
        }
        //if (!key_options.hasOwnProperty('key')) {
        //    console.log(pgm + 'Warning. using default value key=false for key ' + key) ;
        //    key_options.key = false ;
        //}
        return key_options;
    } // get_local_storage_rule


    // get/set item
    function getItem(key) {
        var pgm = 'MoneyNetworkHelper.getItem: ';
        // if (key == 'password') console.log(pgm + 'caller: ' + arguments.callee.caller.toString()) ;
        var pseudo_key = key; // .match(/^gift_[0-9]+$/) ? 'gifts' : key ; // use gifts rule for gift_1, gift_1 etc
        var rule = get_local_storage_rule(pseudo_key);
        if (rule.encrypt) var password_type = (key == 'key' ? 'password' : 'key'); // key is as only variable encrypted with human password
        // userid prefix?
        if (rule.userid) {
            var userid = getItem('userid');
            if ((typeof userid == 'undefined') || (userid == null) || (userid == '')) userid = 0;
            else userid = parseInt(userid);
            if (userid == 0) {
                // console.log(pgm + 'Error. key ' + key + ' is stored with userid prefix but userid was not found') ;
                return null;
            }
            key = userid + '_' + key;
        }
        // read stored value
        var value = rule.session ? session_storage[key] : local_storage[key]; // localStorage.getItem(key);
        // if (pseudo_key == 'user_info') console.log(pgm + 'debug: local_storage = ' + JSON.stringify(local_storage) + ', value = ' + value) ;
        if ((typeof value == 'undefined') || (value == null) || (value == '')) return null; // key not found

        // get storage flag - how was data stored - first character in value
        var storage_flag = value.substr(0, 1);
        value = value.substr(1);
        var storage_options = storage_flags[storage_flag];
        if (!storage_options) {
            console.log(pgm + 'Error. Invalid storage flag ' + storage_flag + ' was found for key ' + key);
            return null;
        }

        // decompress
        if ((storage_options.compress > 0) && (storage_options.sequence == 1)) {
            // reverse encrypt => compress sequence was used when saving this data. decompress before decrypt
            // console.log(pgm + key + ' before decompress = ' + value) ;
            value = decompress1(value);
        }

        // decrypt
        if (storage_options.encrypt) {
            // console.log(pgm + key + ' before decrypt = ' + value) ;
            var password = getItem(password_type); // use key or password
            if ((typeof password == 'undefined') || (password == null) || (password == '')) {
                console.log(pgm + 'Error. key ' + key + ' is stored encrypted but ' + password_type + ' was not found');
                return null;
            }
            value = decrypt(value, password);
        }

        // decompress
        if ((storage_options.compress > 0) && (storage_options.sequence == 0)) {
            // normal compress => encrypt sequence was used when saving this data. decompress after decrypt
            // console.log(pgm + key + ' before decompress = ' + value) ;
            value = decompress1(value);
        }

        // ready
        // if (storage_options.encrypt || storage_options.compress) console.log(pgm + key + ' after decrypt and decompress = ' + value) ;
        // if (key.match(/oauth/)) console.log('getItem. key = ' + key + ', value = ' + value) ;
        return value;
    } // getItem

    function setItem(key, value) {
        var pgm = 'MoneyNetworkHelper.setItem: ';
        // console.log(pgm + 'key = ' + key + ', value = ' + value) ;
        var pseudo_key = key.match(/^gift_[0-9]+$/) ? 'gifts' : key; // use gifts rule for gift_1, gift_1 etc
        var rule = get_local_storage_rule(pseudo_key);
        if (rule.encrypt) var password_type = (key == 'key' ? 'password' : 'key'); // key is as only variable encrypted with human password
        // userid prefix?
        if (rule.userid) {
            var userid = getItem('userid');
            if ((typeof userid == 'undefined') || (userid == null) || (userid == '')) userid = 0;
            else userid = parseInt(userid);
            if (userid == 0) {
                // console.log(pgm + 'Error. key ' + key + ' is stored with userid prefix but userid was not found') ;
                return;
            }
            key = userid + '_' + key;
        }
        // check password
        var password;
        if (rule.encrypt) {
            password = getItem(password_type); // use key or password
            if ((typeof password == 'undefined') || (password == null) || (password == '')) {
                console.log(pgm + 'Error. key ' + key + ' is stored encrypted but ' + password_type + ' was not found');
                return;
            }
        }
        var sequence;
        if (rule.compress && rule.encrypt) {
            // compress and encrypt. find best sequence
            // sequence 0 : normal sequence - compress before encrypt
            // sequence 1 : reverse sequence - encrypt before compress
            var value1 = encrypt(compress1(value), password);
            var value2 = compress1(encrypt(value, password));
            if (value1.length <= value2.length) {
                sequence = 0;
                value = value1;
            }
            else {
                sequence = 1;
                value = value2;
            }
        }
        else {
            sequence = 0;
            // compress?
            if (rule.compress) value = compress1(value);
            // encrypt?
            if (rule.encrypt) value = encrypt(value, password);
        }
        // set storage flag - how are data stored - first character in value
        var storage_options = {
            compress: (rule.compress ? 1 : 0),
            encrypt: (rule.encrypt ? 1 : 0),
            sequence: sequence
        };
        var bin_key = storage_options_bin_key(storage_options);
        var storage_flag = storage_flag_index[bin_key];
        if (!storage_flag) {
            console.log(pgm + 'Error. key ' + key + ' was not saved. Could not found storage flag for storage options = ' + JSON.stringify(storage_options));
            return;
        }
        // if (pseudo_key == 'user_info') console.log(pgm + 'debug: key = ' + key + ', value = ' + value) ;
        value = storage_flag + value;
        // save
        // if (key.match(/oauth/)) console.log('setItem. key = ' + key + ', value = ' + value) ;
        if (rule.session) session_storage[key] = value; // sessionStorage.setItem(key, value);
        else local_storage[key] = value; // localStorage.setItem(key, value);
        // optimize compression for saved value

        // todo: disabled until I find a method to convert byte array returned from LZMA.compress into an valid utf-16 string
        // check if lzma compress if better than lzstring compress
        // if (rule.compress) lzma_compress0(key, save_value, rule.session, password, value.length-1) ;
    } // setItem

    function removeItem(key) {
        var pgm = 'MoneyNetworkHelper.setItem: ';
        var pseudo_key = key.match(/^gift_[0-9]+$/) ? 'gifts' : key; // use gifts rule for gift_1, gift_1 etc
        var rule = get_local_storage_rule(pseudo_key);
        // userid prefix?
        if (rule.userid) {
            var userid = getItem('userid');
            if ((typeof userid == 'undefined') || (userid == null) || (userid == '')) userid = 0;
            else userid = parseInt(userid);
            if (userid == 0) {
                console.log(pgm + 'Error. key ' + key + ' is stored with userid prefix but userid was not found');
                return null;
            }
            key = userid + '_' + key;
        }
        // remove
        if (rule.session) delete session_storage[key]; // sessionStorage.removeItem(key);
        else delete local_storage[key]; // localStorage.removeItem(key);
    } // removeItem

    function getUserId() {
        var userid = MoneyNetworkHelper.getItem('userid');
        if (typeof userid == 'undefined') userid = 0;
        else if (userid == null) userid = 0;
        else if (userid == '') userid = 0;
        else userid = parseInt(userid);
        return userid;
    } // getUserId

    // sha256 digest - used for one way password encryption and signatures for gifts and comments
    // arguments: list of input fields to sha256 calculation
    // todo: ignore empty fields at end of input? will allow adding new empty fields to gifts and comments signature without destroying old signatures
    function sha256() {
        var pgm = 'MoneyNetworkHelper.sha256: ';
        var texts = [];
        for (var i = 0; i < arguments.length; i++) {
            switch (typeof arguments[i]) {
                case 'string' :
                    texts.push(arguments[i]);
                    break;
                case 'boolean':
                    texts.push(arguments[i].toString());
                    break;
                case 'number':
                    texts.push(arguments[i].toString());
                    break;
                case 'undefined':
                    texts.push('');
                    break;
                default:
                    // null or an object
                    if (arguments[i] == null) texts.push('');
                    else texts.push(JSON.stringify(arguments[i]));
            } // switch
        }
        ;
        // strip empty fields from end of sha256 input
        while ((texts.length > 0) && (texts[texts.length - 1] == '')) texts.length = texts.length - 1;
        var text = texts.length == 0 ? '' : texts.join(',');
        var sha256 = CryptoJS.SHA256(text).toString(CryptoJS.enc.Latin1);
        // console.log(pgm + 'text = ' + text + ', sha256 = ' + sha256)
        return sha256;
    } // sha256

    // generate password - used as key for local storage encryption and used in client to client communication (symmetric encryption)
    function generate_random_password(length) {
        var character_set = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789![]{}#%&/()=?+-:;_-.@$|£';
        var password = [], index, char;
        for (var i = 0; i < length; i++) {
            index = Math.floor(Math.random() * character_set.length);
            char = character_set.substr(index, 1);
            password.push(char);
        }
        ;
        return password.join('');
    } // generate_random_password

    // client login (password from device_login_form form)
    // 0 = invalid password, > 0 : userid
    // use create_new_account = true to force create a new user account
    // support for more than one user account
    function client_login(password, create_new_account) {
        var pgm = module + '.client_login: ' ;
        var password_sha256, passwords_s, passwords_a, i, userid, did, crypt, pubkey, prvkey, prvkey_aes, giftid_key;
        password_sha256 = sha256(password);
        // passwords: array with hashed passwords. size = number of accounts
        passwords_s = getItem('passwords');
        // console.log(pgm + 'passwords_s = ' + passwords_s) ;
        if ((passwords_s == null) || (passwords_s == '')) passwords_a = [];
        else passwords_a = JSON.parse(passwords_s);
        // console.log(pgm + 'password_sha256 = ' + password_sha256) ;
        // check old accounts
        for (i = 0; i < passwords_a.length; i++) {
            // console.log(pgm + 'passwords_a[' + i + '] = ' + passwords_a[i]) ;
            if (password_sha256 == passwords_a[i]) {
                // log in ok - account exists
                // console.log(pgm + 'login ok') ;
                userid = i + 1;
                // save login
                setItem('userid', userid);
                setItem('password', password);
                return userid;
            }
        }
        // password was not found
        if (create_new_account) {
            // create new account
            console.log(pgm + 'create new account');
            userid = passwords_a.length + 1; // sequence = number of user accounts in local storage
            // setup new account
            passwords_a.push(password_sha256);
            passwords_s = JSON.stringify(passwords_a);
            // generate key pair for client to client RSA encryption
            crypt = new JSEncrypt({default_key_size: 2048});
            crypt.getKey();
            pubkey = crypt.getPublicKey();
            prvkey = crypt.getPrivateKey();
            // key for symmetric encryption in localStorage - 80-120 characters (avoid using human text in encryption)
            var key_lng = Math.round(Math.random() * 40) + 80;
            var key = MoneyNetworkHelper.generate_random_password(key_lng);
            // save login in sessionStorage
            // note that password is saved in clear text in sessionStorage
            // please use device log out or close browser tab when finished
            setItem('userid', userid);
            setItem('password', password);
            // save new user account
            setItem('key', key);
            setItem('prvkey', prvkey); // private key - only used on this device - never sent to server or other clients
            setItem('pubkey', pubkey); // public key - sent to server and other clients
            setItem('passwords', passwords_s); // array with sha256 hashed passwords. length = number of accounts
            // send local storage updates to ZeroFrame
            local_storage_save();
            return userid;
        }
        // invalid password (create_new_account=false)
        // console.log(pgm + 'invalid password');
        return 0;
    } // client_login


    // client logout
    function client_logout() {
        removeItem('password');
        removeItem('userid');
    } // client_logout


    // export helpers
    return {
        // local storage helpers
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        local_storage_bind: local_storage_bind,
        local_storage_save: local_storage_save,
        zeronet_update_user_info: zeronet_update_user_info,
        zeronet_search: zeronet_search,
        getUserId: getUserId,
        client_login: client_login,
        client_logout: client_logout,
        generate_random_password: generate_random_password
    };
})();
// MoneyNetworkHelper end


// angularJS app
angular.module('MoneyNetwork', ['ngRoute', 'ngSanitize', 'ui.bootstrap'])

    .config(['$routeProvider', function ($routeProvider) {

        // resolve: check if user is logged. check is used in multiple routes
        var check_auth_resolve = ['$location', function ($location) {
            if (!MoneyNetworkHelper.getUserId()) {
                ZeroFrame.cmd("wrapperNotification", ['info', 'Not allowed. Please log in', 3000]);
                $location.path('/auth');
                $location.replace();
            }
        }];

        // setup routes. see ng-template in index.html page
        $routeProvider
            .when('/auth', {
                templateUrl: 'auth.html',
                controller: 'AuthCtrl as a',
            })
            .when('/about', {
                templateUrl: 'about.html'
            })
            .when('/contacts', {
                templateUrl: 'contacts.html',
                resolve: {check_auth: check_auth_resolve}
            })
            .when('/home', {
                templateUrl: 'home.html',
                resolve: {check_auth: check_auth_resolve}
            })
            .when('/logout', {
                resolve: {
                    logout: ['$location', function ($location) {
                        if (MoneyNetworkHelper.getUserId()) ZeroFrame.cmd("wrapperNotification", ['done', 'Log out OK', 3000]) ;
                        else ZeroFrame.cmd("wrapperNotification", ['info', 'Already logged out', 3000]);
                        MoneyNetworkHelper.client_logout();
                        $location.path('/auth');
                        $location.replace();
                    }]
                }
            })
            .when('/user', {
                templateUrl: 'user.html',
                controller: 'UserCtrl as u',
                resolve: {check_auth: check_auth_resolve}
            })
            .otherwise({
                redirectTo: function (routeParams, path, search) {
                    return '/auth';
                }
            });
        // end config (ng-routes)
    }])


    .factory('MoneyNetworkService', ['$timeout', function($timeout) {
        var self = this;
        var service = 'MoneyNetworkService' ;
        console.log(service + ' loaded') ;

        // startup tag cloud. Tags should be created by users and shared between contacts.
        // Used in typeahead autocomplete functionality http://angular-ui.github.io/bootstrap/#/typeahead
        var tags = ['Name', 'Email', 'Phone', 'Photo', 'Company', 'URL', 'GPS'];
        function get_tags() {
            return tags ;
        }

        // user info. Array with tag, value and privacy.
        // saved in localStorage. Shared with contacts depending on privacy choice
        var user_info = [] ;
        function empty_user_info_line() {
            return { tag: '', value: '', privacy: ''} ;
        }
        function load_user_info () {
            var pgm = service + '.load_user_info: ';
            // load user info from local storage
            var user_info_str, new_user_info ;
            user_info_str = MoneyNetworkHelper.getItem('user_info') ;
            // console.log(pgm + 'user_info_str = ' + user_info_str) ;
            if (user_info_str) new_user_info = JSON.parse(user_info_str) ;
            else new_user_info = [empty_user_info_line()] ;
            user_info.splice(0,user_info.length) ;
            for (var i=0 ; i<new_user_info.length ; i++) user_info.push(new_user_info[i]) ;
            // load user info from ZeroNet
            // compare
            console.log(pgm + 'todo: user info loaded from localStorage. must compare with user_info stored in data.json') ;
        }
        function get_user_info () {
            return user_info ;
        }
        function save_user_info () {
            var pgm = service + '.save_user_info: ';
            MoneyNetworkHelper.setItem('user_info', JSON.stringify(user_info)) ;
            $timeout(function () {
                MoneyNetworkHelper.local_storage_save() ;
                MoneyNetworkHelper.zeronet_update_user_info() ;
                MoneyNetworkHelper.zeronet_search() ;
            })
        }

        // privacy options for user info - descriptions in privacyTitleFilter
        var privacy_options = ['Search', 'Public', 'Unverified', 'Verified', 'Hidden'] ;
        function get_privacy_options () {
            return privacy_options ;
        }
        var show_privacy_title = false ;
        function get_show_privacy_title() {
            return show_privacy_title ;
        }
        function set_show_privacy_title (show) {
            show_privacy_title = show ;
        }

        return {
            get_tags: get_tags,
            get_privacy_options: get_privacy_options,
            get_show_privacy_title: get_show_privacy_title,
            set_show_privacy_title: set_show_privacy_title,
            empty_user_info_line: empty_user_info_line,
            load_user_info: load_user_info,
            get_user_info: get_user_info,
            save_user_info: save_user_info
        };
        // end MoneyNetworkService
    }])


    .controller('NavCtrl', [function () {
        var self = this;
        var controller = 'NavCtrl';
        console.log(controller + ' loaded');
        self.texts = {appname: 'Money Network'};

    }])


    .controller('AuthCtrl', ['$location', 'MoneyNetworkService', function ($location, moneyNetworkService) {
        var self = this;
        var controller = 'AuthCtrl';
        console.log(controller + ' loaded');

        self.is_logged_in = function () {
            return MoneyNetworkHelper.getUserId();
        };
        self.register = 'N' ;
        function set_register_yn() {
            var pgm = controller + '.login_or_register: ' ;
            var passwords, no_users ;
            passwords = MoneyNetworkHelper.getItem('passwords') ;
            if (!passwords) no_users = 0 ;
            else no_users = JSON.parse(passwords).length ;
            self.register = (no_users == 0) ? 'Y' : 'N';
        }
        MoneyNetworkHelper.local_storage_bind(set_register_yn) ;

        self.login_disabled = function () {
            if (self.register != 'N') return true;
            if (!self.device_password) return true;
            if (self.device_password.length < 10) return true;
            if (self.device_password.length > 50) return true;
            return false;
        };
        self.register_disabled = function () {
            if (self.register != 'Y') return true;
            if (!self.device_password) return true;
            if (self.device_password.length < 10) return true;
            if (self.device_password.length > 50) return true;
            if (!self.confirm_device_password) return true;
            return (self.device_password != self.confirm_device_password);
        };
        self.login_or_register = function () {
            var pgm = controller + '.login_or_register: ';
            self.login_or_register_error = '';
            var create_new_account = (self.register == 'Y');
            var userid = MoneyNetworkHelper.client_login(self.device_password, create_new_account);
            if (userid == 0) {
                var error = 'Invalid password' ;
                self.login_or_register_error = error;
                ZeroFrame.cmd("wrapperNotification", ['error', error, 3000]);
            }
            else {
                // clear login form
                ZeroFrame.cmd("wrapperNotification", ['done', 'Log in OK', 3000]);
                self.device_password = '';
                self.confirm_device_password = '';
                self.register = 'N';
                moneyNetworkService.load_user_info() ;
                var user_info = moneyNetworkService.get_user_info() ;
                var empty_user_info_str = JSON.stringify([moneyNetworkService.empty_user_info_line()]) ;
                if (JSON.stringify(user_info) == empty_user_info_str) $location.path('/user');
                else $location.path('/home');
                $location.replace();
            }
        };

    }])


    .controller('UserCtrl', ['$scope', 'MoneyNetworkService', function($scope, moneyNetworkService) {
        var self = this;
        var controller = 'UserCtrl';
        console.log(controller + ' loaded');

        self.user_info = moneyNetworkService.get_user_info() ; // array with tags and values
        self.tags = moneyNetworkService.get_tags() ; // typeahead autocomplete functionality
        self.privacy_options = moneyNetworkService.get_privacy_options() ; // select options with privacy settings for user info
        self.show_privacy_title = moneyNetworkService.get_show_privacy_title() ; // checkbox - display column with privacy descriptions?

        // add empty rows to user info table. triggered in privacy field. enter and tab (only for last row)
        self.insert_row = function(row) {
            var pgm = controller + '.insert_row: ' ;
            var index ;
            for (var i=0 ; i<self.user_info.length ; i++) if (self.user_info[i].$$hashKey == row.$$hashKey) index = i ;
            index = index + 1 ;
            self.user_info.splice(index, 0, moneyNetworkService.empty_user_info_line());
            $scope.$apply();
        };
        self.delete_row = function(row) {
            var pgm = controller + '.delete_row: ' ;
            var index ;
            for (var i=0 ; i<self.user_info.length ; i++) if (self.user_info[i].$$hashKey == row.$$hashKey) index = i ;
            // console.log(pgm + 'row = ' + JSON.stringify(row)) ;
            self.user_info.splice(index, 1);
            if (self.user_info.length == 0) self.user_info.splice(index, 0, moneyNetworkService.empty_user_info_line());
        };

        // user_info validations
        self.is_tag_required = function(row) {
            if (row.value) return true ;
            if (row.privary) return true ;
            return false ;
        };
        self.is_value_required = function(row) {
            if (!row.tag) return false ;
            if (row.tag == 'GPS') return false ;
            return true ;
        };
        self.is_privacy_required = function(row) {
            if (row.tag) return true ;
            if (row.value) return true ;
            return false ;
        };

        self.show_privacy_title_changed = function () {
            moneyNetworkService.set_show_privacy_title(self.show_privacy_title)
        };

        self.update_user_info = function () {
            var pgm = controller + '.update_user_info: ' ;
            // console.log(pgm + 'calling moneyNetworkService.save_user_info()');
            moneyNetworkService.save_user_info() ;
            // console.log(pgm) ;
        };
        self.revert_user_info = function () {
            var pgm = controller + '.revert_user_info: ' ;
            moneyNetworkService.load_user_info() ;
            // console.log(pgm) ;
        };

    }])


    // catch key enter event in user info table (insert new empty row in table)
    // also cacthing on key tab event for last row in table (insert row empty row at end of table)
    // used for UserCtl.insert_row
    // http://stackoverflow.com/questions/17470790/how-to-use-a-keypress-event-in-angularjs
    // https://gist.github.com/singhmohancs/317854a859098bffe9477f59eac8d915
    .directive('onKeyEnter', ['$parse', function($parse) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.bind('keydown keypress', function(event) {
                    if ((event.which === 13) || ((event.which === 9) && scope.$last)) {
                        var attrValue = $parse(attrs.onKeyEnter);
                        (typeof attrValue === 'function') ? attrValue(scope) : angular.noop();
                        event.preventDefault();
                    }
                });
                scope.$on('$destroy', function() {
                    element.unbind('keydown keypress')
                })
            }
        };
    }])


    .filter('privacyTitle', [function () {
        // title for user info privacy selection. mouse over help
        // Search - search word is stored on server together with a random public key.
        //          server will match search words and return matches to clients
        // Public - info send to other contact after search match. Info is show in contact suggestions (public profile)
        // Unverified - info send to other unverified contact after adding contact to contact list (show more contact info)
        // Verified - send to verified contact after verification through a secure canal (show more contact info)
        // Hidden - private, hidden information. Never send to server or other users.
        var privacy_titles = {
            Search: "Search values are stored in a database and are used when searching for contacts. Shared unencrypted with all other ZeroNet clients. Regular expressions with a low number of matches are supported",
            Public: "Info is sent encrypted to other contact after search match. Public Info is shown in contact search and contact suggestions. Your public profile",
            Unverified: "Info is sent encrypted to other unverified contact after adding contact to contact list. Additional info about you to other contact",
            Verified: "Info is sent encrypted to verified contact after contact verification through a secure canal. Your private profile",
            Hidden: "Private, hidden information. Never send to other users"
        };
        return function (privacy) {
            return privacy_titles[privacy] || 'Start typing. Select privacy level';
        } ;
        // end privacyTitle filter
    }])

;

// angularJS app end
