package cn.arorms.email.dto;

/**
 * Attachment metadata exposed via API.
 */
public record AttachmentDto(
    Long id,
    String filename,
    String contentType,
    Long size
) {
}
