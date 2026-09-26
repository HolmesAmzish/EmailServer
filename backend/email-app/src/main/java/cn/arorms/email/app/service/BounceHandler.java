package cn.arorms.email.app.service;

import cn.arorms.email.app.entity.MailRecipient;
import cn.arorms.email.common.enums.DeliveryStatus;
import cn.arorms.email.app.repository.MailRecipientRepository;
import cn.arorms.email.app.service.mime.ParsedMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Handles delivery status notifications (bounces) by updating the original mail status.
 */
@Component
public class BounceHandler {

    private static final Logger log = LoggerFactory.getLogger(BounceHandler.class);

    private final MailRecipientRepository mailRecipientRepository;

    public BounceHandler(MailRecipientRepository mailRecipientRepository) {
        this.mailRecipientRepository = mailRecipientRepository;
    }

    /**
     * Updates the original sent mail's recipient status to FAILED.
     */
    @Transactional
    public void handle(ParsedMessage bounce) {
        if (!bounce.bounce() || bounce.originalMessageId() == null) {
            return;
        }

        String originalMessageId = bounce.originalMessageId();
        String failedRecipient = bounce.failedRecipient();

        if (failedRecipient == null || failedRecipient.isBlank()) {
            log.warn("Bounce detected but failed recipient is unknown for original message {}", originalMessageId);
            return;
        }

        Optional<MailRecipient> recipient = mailRecipientRepository
            .findByMail_MessageIdAndRecipient(originalMessageId, failedRecipient);

        if (recipient.isPresent()) {
            MailRecipient r = recipient.get();
            r.setStatus(DeliveryStatus.FAILED);
            r.setErrorMessage(bounce.bounceReason());
            log.info("Marked mail {} to {} as FAILED", originalMessageId, failedRecipient);
        } else {
            log.warn("Could not find original recipient {} for bounced message {}", failedRecipient, originalMessageId);
        }
    }
}
