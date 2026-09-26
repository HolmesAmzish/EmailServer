package cn.arorms.email.common.responses;

public record AttachmentVo (
    Long id,
    String filename,
    String contentType,
    long size
) {
}