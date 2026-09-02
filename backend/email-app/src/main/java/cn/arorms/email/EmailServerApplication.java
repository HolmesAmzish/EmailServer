package cn.arorms.email;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class EmailServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EmailServerApplication.class, args);
    }
}
