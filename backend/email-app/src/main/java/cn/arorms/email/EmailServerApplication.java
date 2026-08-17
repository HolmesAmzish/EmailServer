package cn.arorms.email;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "cn.arorms.email")
@ConfigurationPropertiesScan(basePackages = "cn.arorms.email")
@EntityScan(basePackages = "cn.arorms.email.domain.entity")
@EnableJpaRepositories(basePackages = "cn.arorms.email.domain.repository")
public class EmailServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EmailServerApplication.class, args);
    }
}