package cn.arorms.email.property;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

/**
 * Configuration for Maildir paths used to receive incoming mails.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "application.maildir")
public class MaildirProperties {

    private String basePath = "/var/mail/Maildir";

    public Path newPath() {
        return Path.of(basePath, "new");
    }

    public Path curPath() {
        return Path.of(basePath, "cur");
    }

    public Path deadLetterPath() {
        return Path.of(basePath, "dead-letter");
    }
}
