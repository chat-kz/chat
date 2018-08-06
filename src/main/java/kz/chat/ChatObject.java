package kz.chat;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

class ChatObject implements Serializable {

    private static final String format = "{\"fromUser\":\"%s\",\"toUser\":\"%s\",\"message\":\"%s\",\"messageDate\":\"%s\"}";
    private String fromUser;
    private String toUser;
    private String message;
    private String messageDate = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").format(LocalDateTime.now());

    public ChatObject() {
    }

    ChatObject(String fromUser, String toUser, String message) {
        super();
        this.fromUser = fromUser;
        this.toUser = toUser;
        this.message = message;
    }

    public void setFromUser(String fromUser) {
        this.fromUser = fromUser;
    }
    String getFromUser() {
        return fromUser;
    }

    public void setToUser(String toUser) {
        this.toUser = toUser;
    }
    String getToUser() {
        return toUser;
    }

    public void setMessage(String message) {
        this.message = message;
    }
    String getMessage() {
        return message;
    }

    @Override
    public String toString() {
        return String.format(format, fromUser, toUser, message, messageDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fromUser,toUser,message,messageDate);
    }

}
