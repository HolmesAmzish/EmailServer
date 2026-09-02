package cn.arorms.email.service.mime;

/**
 * Metadata of an email attachment extracted from MIME.
 * Actual content is not stored yet; reserved for future MINIO integration.
 */
public record ParsedAttachment(
    String filename,
    String contentType,
    long size,
    String checksum
) {
}
