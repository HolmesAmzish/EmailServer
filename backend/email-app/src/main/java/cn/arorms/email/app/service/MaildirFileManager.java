package cn.arorms.email.app.service;

import cn.arorms.email.app.property.MaildirProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Handles Maildir file lifecycle: archiving processed mails to cur/ and moving failures to dead-letter/.
 */
@Component
public class MaildirFileManager {

    private final MaildirProperties properties;

    public MaildirFileManager(MaildirProperties properties) {
        this.properties = properties;
    }

    /**
     * Moves a processed file from new/ to cur/ with the standard Maildir info suffix.
     */
    public Path archive(Path source) throws IOException {
        Path target = properties.curPath().resolve(source.getFileName().toString() + ":2,");
        Files.createDirectories(properties.curPath());
        return Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
    }

    /**
     * Moves a failed file to dead-letter/ for manual inspection.
     */
    public Path deadLetter(Path source, String reason) throws IOException {
        Path dir = properties.deadLetterPath();
        Files.createDirectories(dir);
        Path target = dir.resolve(source.getFileName().toString());
        return Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
    }

    /**
     * Permanently removes a processed Maildir file when its mail record is deleted.
     */
    public void delete(Path source) throws IOException {
        Files.deleteIfExists(source);
    }
}
