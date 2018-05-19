package com.sevis.cad;

import java.util.ArrayList;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import springfox.documentation.service.ApiInfo;
import springfox.documentation.service.Tag;
import springfox.documentation.service.VendorExtension;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spring.web.plugins.Docket;

@Configuration
public class SpringfoxConfiguration {

    @Bean
    public Docket docket() {
        return new Docket(DocumentationType.SWAGGER_2)
        			.tags(new Tag("Employee Entity", "Repository for Employee entities"))
                .apiInfo(new ApiInfo("Customer Service API", "REST API of the Customer Service", "v42", null, ApiInfo.DEFAULT_CONTACT, null, null, new ArrayList<VendorExtension>()));
    }

}
