package cn.arorms.email.app.exception;

import cn.arorms.framework.common.exception.BaseExceptionHandler;
import jakarta.mail.MessagingException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Global exception handler for the email REST API.
 * Inherits common exception handling from {@link BaseExceptionHandler}
 * and adds handlers for this project's specific exceptions.
 *
 * @author cacc
 * @version 1.0 2026-09-28
 * @since 2026-09-28
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends BaseExceptionHandler {

    /**
     * Handle mail protocol errors (send / parse failures)
     */
    @ExceptionHandler(MessagingException.class)
    public ResponseEntity<String> handleMessagingException(MessagingException ex) {
        return ResponseEntity.internalServerError().body("Mail operation failed: " + ex.getMessage());
    }

    /**
     * Handle request body validation errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<String> handleValidationException(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
                .reduce((a, b) -> a + ", " + b)
                .orElse("Validation failed");
        return ResponseEntity.badRequest().body("Validation Failed: " + errors);
    }

    /**
     * Handle path/query parameter type mismatch
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<String> handleTypeMismatchException(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
                .body("Parameter '" + ex.getName() + "' should be of type " + ex.getRequiredType().getSimpleName());
    }

    /**
     * Handle missing required request parameters
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<String> handleMissingParameterException(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest().body("Missing required parameter: " + ex.getParameterName());
    }

    /**
     * Handle malformed request body
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<String> handleNotReadableException(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body("Malformed request body");
    }
}