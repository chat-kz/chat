package kz.chat;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.DisconnectListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Objects;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class MainContextListener implements ServletContextListener {
    private static final Logger logger = LoggerFactory.getLogger(MainContextListener.class);
    private static final String configFileName = System.getProperty("jboss.server.config.dir") + "/chat.properties";
    private static final String PROPERTY_NAME_HOST = "127.0.0.1";
    private static final String PROPERTY_NAME_PORT = "9999";
    private static final String configError = "%s for CHAT is null! Try to look at configuration file placed on \"" +
            "jboss.server.config.dir/chat.properties\"";
    private static final ConcurrentHashMap<String, SocketIOClient> clientsList = new ConcurrentHashMap<>();
    private static final Properties props = new Properties();
    private static SocketIOServer server;

    private static Properties getProperties() {
        if (props.isEmpty()) {
            try (FileInputStream fis = new FileInputStream(configFileName)) {
                props.load(fis);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        return props;
    }

    private static String getHost() {
        return /*getProperties().getProperty(*/PROPERTY_NAME_HOST/*)*/;
    }

    private static Integer getPort() {
        String v = /*getProperties().getProperty(*/PROPERTY_NAME_PORT/*)*/;
        return (v != null && !v.trim().isEmpty()) ? Integer.valueOf(v) : null;
    }

    @Override
    public void contextInitialized(ServletContextEvent servletContextEvent) {
        logger.info("Trying to initialize context of chat-server...");
        // reading configuration (host & port) from property file
        String host = getHost();
        Integer port = getPort();
        Objects.requireNonNull(host,String.format(configError, PROPERTY_NAME_HOST));
        Objects.requireNonNull(port,String.format(configError, PROPERTY_NAME_PORT));
        logger.info("host="+host);
        logger.info("port="+port);
        // creating server configuration
        Configuration serverConfig = new Configuration();
        serverConfig.setHostname(host);
        serverConfig.setPort(port);
        // creating server based on serverConfig
        server = new SocketIOServer(serverConfig);
        setServerEventsListeners(server);
        // starting
        server.start();
    }

    @Override
    public void contextDestroyed(ServletContextEvent servletContextEvent) {
        logger.info("Destroying context of chat-server...");
        server.stop();
    }

    private static void setServerEventsListeners(final SocketIOServer server) {
        server.addEventListener("login", String.class, (socketIOClient, userLogin, ackRequest) -> {
            logger.info("Trying to log in as '" + userLogin + "'...");
            if (clientsList.containsKey(userLogin)) {
                socketIOClient.sendEvent("userAlreadyLoggedIn", new ChatObject(userLogin, null, null));
                logger.info("User '" + userLogin + "' is already logged in!");
            } else {
                // разошлем всем сообщение о том что новый пользователь законектился
                clientsList.entrySet().forEach(el -> el.getValue().sendEvent("newUserConnected", userLogin));
                // зарегистрируем его в списке контактов
                clientsList.put(userLogin, socketIOClient);
                logger.info("Success! Logged as '" + userLogin + "'.");
                // отдадим пользователю список контактов
                StringBuilder clients = new StringBuilder();
                clientsList.entrySet().forEach(el -> {
                    if (clients.length() > 0) {
                        clients.append(',');
                    }
                    clients.append(el.getKey());
                });
                socketIOClient.sendEvent("contactList", clients.toString());
                logger.info("contacts send to user '" + userLogin + "' : {" + clients.toString() + "}");
            }
        });

        server.addEventListener("chatEvent", ChatObject.class,
                (client, data, ackRequest) -> {
                    if (data.getToUser() == null && data.getToUser().trim().isEmpty()) {
                        server.getBroadcastOperations().sendEvent("chatEvent", data);
                    } else {
                        clientsList.entrySet().stream()
                                .filter(el -> el.getKey().equals(data.getToUser()))
                                .collect(Collectors.toList())
                                .forEach(item ->
                                        item.getValue().sendEvent("chatEvent", new ChatObject(data.getFromUser(),
                                                data.getToUser(), data.getMessage()).toString())
                                );
                    }
                });

        DisconnectListener disconnectListener = socketIOClient -> {
            if (clientsList.containsValue(socketIOClient)) {
                clientsList.entrySet().stream()
                        .filter(el -> el.getValue().equals(socketIOClient))
                        .collect(Collectors.toList())
                        .forEach(item -> {
                            String login = item.getKey();
                            clientsList.remove(login);
                            clientsList.entrySet().forEach(el -> el.getValue().sendEvent("userDisconnected", login));
                            logger.info("User '" + login + "' logged out!");
                        });
            }
        };

        server.addDisconnectListener(disconnectListener);
    }

}
