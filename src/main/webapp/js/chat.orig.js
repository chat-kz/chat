/* закешируем объекты */
var contactList = document.getElementById('contactList');
var contacts = document.getElementById('contacts');
var textInputWindow = document.getElementById('textInputWindow');
var chatContent = document.getElementById('chatContent');
var msgText = document.getElementById('msgText');
var userLogin = sessionStorage.getItem('userName');
var textInputWindowText = document.getElementById('textInputWindowText');
var lastOutMessageEl = null;
var lastOutMessageData = null;
var lastInMessageEl = null;
var lastInMessageData = null;
var msgCount = 0;
var currentMessageReceiver;
var users = [];
var socket;
var scrollTopBeforeAppendMessage=0;
var myUnreadMessagesWhenCustomScroll = 0;

/* добавляет контакт в список контактов */
var addContact = function(login) {
    var el = document.createElement('LI');
    el.textContent = login;
    addListener(el,'click',loadChatWindow);
    contacts.appendChild(el);
};

/* удаляет контакт из списка контактов */
var removeContact = function(login) {
    if (contacts.hasChildNodes()) {
        [].slice.call(contacts.children).forEach(function(el) {
            if (el.childNodes[0] && el.childNodes[0].data == login) {
                contacts.removeChild(el);
            }
        });
    }
};

var clearContacts = function () {
    contacts.innerHTML = '';
};

var updateUsersList = function() {
    clearContacts();
    if (users.length > 0) {
        users.sort(
            function (n1, n2) {
                if (n1 > n2) {
                    return 1;
                }
                else if (n1 < n2) {
                    return -1;
                }
                return 0;
            }
        );
        for (var u in users) {
            addContact(users[u]);
        }
        allMessagesFromContactIsRead('');
    }
};

var appendMessage = function(data, isIncomeMessage) {
    msgCount++;
    scrollTopBeforeAppendMessage = chatContent.scrollHeight-chatContent.offsetHeight;
    // входящее сообщение автоматом стирает последнее сообщение,
    // мы не сможем его дополнять своими сообщениями,
    // так же для исходящего
    if (isIncomeMessage) {
        lastOutMessageEl = null;
        lastOutMessageData = null;
    } else {
        lastInMessageEl = null;
        lastInMessageData = null;
    }
    // группировка входящих сообщений если в одну и ту же минуту сообщения приходят
    if (isIncomeMessage && lastInMessageData && data.messageDate == lastInMessageData.messageDate) {
        var inContainer = lastInMessageEl.getElementsByClassName("in")[0];
        var inMsgTime = inContainer.getElementsByClassName("time")[0];
        inContainer.removeChild(inMsgTime);
        inContainer.innerHTML += '<br/><span>'+data.fromUser+':'+escapeHTML(data.message)+'</span>'+
            '<span class="time">'+data.messageDate+'</span>';
    }
    // группировка исходящих сообщений если в одну и ту же минуту сообщения уходят
    else if (!isIncomeMessage && lastOutMessageData && data.messageDate == lastOutMessageData.messageDate) {
        var outContainer = lastOutMessageEl.getElementsByClassName("out")[0];
        var outMsgTime = outContainer.getElementsByClassName("time")[0];
        outContainer.removeChild(outMsgTime);
        outContainer.innerHTML += '<br/><span>'+data.fromUser+':'+escapeHTML(data.message)+'</span>'+
            '<span class="time">'+data.messageDate+'</span>';
    } else {
        var divEl = document.createElement('DIV');
        divEl.id = 'msg_no' + msgCount;
        divEl.className = isIncomeMessage ? 'message right' : 'message left';
        var inout = isIncomeMessage ? 'in' : 'out';
        divEl.innerHTML = '<div class="' + inout + '"><span>' + data.fromUser + ':' + escapeHTML(data.message) + '</span>' +
            '<span class="time">' + data.messageDate + '</span></div>';
        chatContent.appendChild(divEl);
        if (!isIncomeMessage) {
            lastOutMessageEl = divEl;
        } else {
            lastInMessageEl = divEl;
        }
    }
    if (!isIncomeMessage) {
        lastOutMessageData = data;
    } else {
        lastInMessageData = data;
    }
    scrollToBottom();
};

var sendMsg = function() {
    if (msgText.value != '') {
        var d = new Date(),
            dateString = ("0" + d.getDate()).slice(-2) + "." + ("0"+(d.getMonth()+1)).slice(-2) + "." +
                d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2),
            chatObject = {fromUser: userLogin, toUser: currentMessageReceiver, message: msgText.value,
                messageDate: dateString};
        appendMessage(chatObject, false);
        saveToHistory(currentMessageReceiver, chatObject);
        socket.emit('chatEvent', chatObject);
        msgText.value = '';
    }
};

var scrollToBottom = function() {
    var newCalculatedScrollTop = chatContent.scrollHeight-chatContent.offsetHeight;
    if (chatContent.scrollTop == scrollTopBeforeAppendMessage) {
        chatContent.scrollTop = newCalculatedScrollTop;
    }
};

var keyPress = function(e) {
    // Submit the form on enter
    if (e.which == 13) {
        e.preventDefault();
        sendMsg();
    }
};

var loadChatWindow = function() {
    currentMessageReceiver = event.currentTarget.childNodes[0].data;
    textInputWindowText.textContent=writeTo + currentMessageReceiver;
    chatContent.innerHTML = '';
    scrollTopBeforeAppendMessage = 0;
    myUnreadMessagesWhenCustomScroll = 0;
    showChatWindow();
    lastOutMessageData = null;
    lastOutMessageEl = null;
    lastInMessageData = null;
    lastInMessageEl = null;
    loadFromHistory(currentMessageReceiver);
    loadUnreadMessagesFromContact(currentMessageReceiver);
    allMessagesFromContactIsRead(currentMessageReceiver);
};

var closeChatWindow = function() {
    textInputWindow.style.display='none';
};

var showChatWindow = function() {
    textInputWindow.style.display='';
};

var minimizeContactsWindow = function() {
    contactList.style.display = 'none';
};

var maximizeContactsWindow = function() {
    contactList.style.display = '';
};

var toggleContactsWindow = function() {
    var obj = event.currentTarget;
    if (contactList.style.display == 'none') {
        maximizeContactsWindow();
        obj.textContent = minimize;
    } else {
        minimizeContactsWindow();
        obj.textContent = expand;
    }
};

var addListener = function(element, eventName, handler) {
    if (element.addEventListener) {
        element.addEventListener(eventName, handler, false);
    }
    else if (element.attachEvent) {
        element.attachEvent('on' + eventName, handler);
    }
    else {
        element['on' + eventName] = handler;
    }
};

closeChatWindow();
minimizeContactsWindow();

var initSocket = function(login) {
    socket = io.connect(cs61796);// cs61796 глоб.перем. протокол:хост:порт
    userLogin = login;

    socket.on('connect', function () {
        socket.emit('login', userLogin);
    });

    socket.on('userAlreadyLoggedIn', function () {
        socket.disconnect();
    });

    socket.on('newUserConnected', function (contact) {
        if (users.indexOf(contact) == -1) {
            users.push(contact);
            updateUsersList();
        }
    });

    socket.on('userDisconnected', function (contact) {
        var idx = users.indexOf(contact);
        if (idx != -1) {
            users.splice(idx,1);
            updateUsersList();
        }
    });

    socket.on('chatEvent', function (data) {
        var chatObject = JSON.parse(data);
        processNewMessage(chatObject);
    });

    socket.on('contactList', function (data) {
        users = data.split(',');
        updateUsersList();
    });
};

/* обработка нового сообщения */
var processNewMessage = function(data) {
    // если отправитель = текущее открытое окно то добавим сообщение просто в окно
    if (data.fromUser == currentMessageReceiver && textInputWindow.style.display != 'none') {
        appendMessage(data, true);
        saveToHistory(currentMessageReceiver, data);
        if (chatContent.scrollTop != (chatContent.scrollHeight-chatContent.offsetHeight)) {
            myUnreadMessagesWhenCustomScroll++;
            setUnreadMessageCountForContact(currentMessageReceiver, myUnreadMessagesWhenCustomScroll);
        } else {
            myUnreadMessagesWhenCustomScroll = 0;
            setUnreadMessageCountForContact(currentMessageReceiver, null);
        }
    } else {
        // иначе добавим в непрочитанные
        var unreadMessages = sessionStorage.getItem('unreadMessages');
        unreadMessages = unreadMessages ? JSON.parse(unreadMessages) : [];
        unreadMessages.push(data);
        sessionStorage.setItem('unreadMessages', JSON.stringify(unreadMessages));
        updateUnreadMessagesAtContactList(unreadMessages);
    }
};

var loadUnreadMessagesFromContact = function(contact) {
    var unreadMessages = sessionStorage.getItem('unreadMessages');
    unreadMessages = unreadMessages ? JSON.parse(unreadMessages) : null;
    if (unreadMessages) {
        for (var i = 0, size = unreadMessages.length; i < size; i++) {
            if (unreadMessages[i].fromUser == contact) {
                appendMessage(unreadMessages[i], true);
                saveToHistory(currentMessageReceiver, unreadMessages[i]);
            }
        }
    }
};

var allMessagesFromContactIsRead = function(contact) {
    var unreadMessages = sessionStorage.getItem('unreadMessages');
    unreadMessages = unreadMessages ? JSON.parse(unreadMessages) : null;
    if (unreadMessages) {
        unreadMessages = unreadMessages.filter(function(data) {return data.fromUser != contact;});
        sessionStorage.setItem('unreadMessages', JSON.stringify(unreadMessages));
        updateUnreadMessagesAtContactList(unreadMessages);
    }
};

var updateUnreadMessagesAtContactList = function(unreadMessages) {
    var usersUnreadMessages = {};
    for (var u in users) {
        var user = users[u];
        for (var i=0, size=unreadMessages.length; i<size; i++) {
            if (user == unreadMessages[i].fromUser) {
                if (usersUnreadMessages[user] != null) {
                    var cnt = usersUnreadMessages[user];
                    cnt = 1 + cnt;
                    usersUnreadMessages[user] = cnt;
                } else {
                    usersUnreadMessages[user] = 1;
                }
            }
        }
        setUnreadMessageCountForContact(user, usersUnreadMessages[user]);
    }
};

var setUnreadMessageCountForContact = function(login, unreadMessagesCount) {
    if (contacts.hasChildNodes()) {
        [].slice.call(contacts.children).forEach(function(el) {
            if (el.childNodes[0] && el.childNodes[0].data == login) {
                if (unreadMessagesCount != null) {
                    el.innerHTML = login + '<span>' + unreadMessagesCount + '</span>';
                } else {
                    el.innerHTML = login;
                }
            }
        });
    }
};

var saveToHistory = function(login, data) {
    var storageName = userLogin + '.' + login + '.history';
    var messages = sessionStorage.getItem(storageName);
    messages = messages ? JSON.parse(messages) : null;
    if (!messages) {
        messages = [];
    }
    messages.push(data);
    // если кол-во сообщений больше 50 то урежем массив до 50 последних сообщений
    if (messages.length>50) {
        messages.splice(0,1);
    }
    sessionStorage.setItem(storageName,JSON.stringify(messages));
};

var loadFromHistory = function(login) {
    var storageName = userLogin + '.' + login + '.history';
    var messages = sessionStorage.getItem(storageName);
    messages = messages ? JSON.parse(messages) : null;
    if (!messages) {
        return;
    }
    messages.forEach(function(item) {
        appendMessage(item, item.fromUser != userLogin);
    });
};

var escapeHTML = function(s) {
    return s.replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

var onChatContentScroll = function (e) {
    // если скролл в конце окна значит можно обнулить кол-во непрочитанных сообщений.
    if (myUnreadMessagesWhenCustomScroll>0 &&
            chatContent.scrollTop == (chatContent.scrollHeight - chatContent.offsetHeight)) {
        myUnreadMessagesWhenCustomScroll = 0;
        setUnreadMessageCountForContact(currentMessageReceiver, null);
    }
};

addListener(chatContent,'scroll',onChatContentScroll);

var login = function() {
    if (sessionStorage.getItem('userName') == null || sessionStorage.getItem('userName') == '') {
        document.getElementById('loginDialog').style.display = '';
    } else {
        initSocket(sessionStorage.getItem('userName'));
    }
};

var writeTo, minimize, expand;

login();