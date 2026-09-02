package cn.arorms.email.service;

import cn.arorms.email.property.MaildirProperties;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;

/**
 * Watches the Maildir new/ directory for incoming mail files using WatchService (inotify on Linux).
 */
@Component
public class MaildirWatcher implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(MaildirWatcher.class);

    private final MaildirProperties properties;
    private final MaildirProcessor processor;
    private WatchService watchService;
    private Thread watchThread;
    private volatile boolean running = false;

    public MaildirWatcher(MaildirProperties properties, MaildirProcessor processor) {
        this.properties = properties;
        this.processor = processor;
    }

    @Override
    public void start() {
        Path newPath = properties.newPath();
        try {
            Files.createDirectories(newPath);
            watchService = FileSystems.getDefault().newWatchService();
            newPath.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);
            running = true;
            watchThread = new Thread(this::watchLoop, "maildir-watcher");
            watchThread.setDaemon(true);
            watchThread.start();
            log.info("Started watching maildir: {}", newPath);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to start maildir watcher", e);
        }
    }

    private void watchLoop() {
        while (running) {
            try {
                WatchKey key = watchService.take();
                for (WatchEvent<?> event : key.pollEvents()) {
                    Path fileName = (Path) event.context();
                    Path file = properties.newPath().resolve(fileName);
                    processor.process(file);
                }
                key.reset();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Error in maildir watch loop", e);
            }
        }
    }

    @Override
    public void stop() {
        running = false;
        if (watchThread != null) {
            watchThread.interrupt();
        }
        if (watchService != null) {
            try {
                watchService.close();
            } catch (IOException e) {
                log.error("Failed to close watch service", e);
            }
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
