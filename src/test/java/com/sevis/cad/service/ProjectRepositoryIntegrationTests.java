package com.sevis.cad.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.Assert.assertEquals;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.junit4.SpringRunner;

import com.sevis.cad.domain.Project;
import com.sevis.cad.service.ProjectRepository;

/**
 * @author ssrinivasulu
 *
 */
@RunWith(SpringRunner.class)
@SpringBootTest
public class ProjectRepositoryIntegrationTests {

	@Autowired
	ProjectRepository repository;
	DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM/dd/yyyy");

	@Test
	public void findsFirstPageOfProjects() {
		Page<Project> projects = this.repository.findAll(new PageRequest(0, 10));
		assertThat(projects.getTotalElements()).isGreaterThan(20L);
	}

	@Test
	public void findByNameAndCountry() {
		String dob="01/12/2018";
		java.util.Date start_date = java.sql.Date.valueOf(LocalDate.parse(dob, formatter));
		Project project = this.repository.findByNameContainingAndStartDateGreaterThanEqual("TicketMaster",
				start_date);
		assertThat(project).isNotNull();
		assertThat(project.getName()).isEqualTo("TicketMaster");
	}

	@Test
	public void findContaining() {
		String dob="01/12/2018";
		java.util.Date start_date = java.sql.Date.valueOf(LocalDate.parse(dob, formatter));
		Page<Project> employees = this.repository
				.findAllByNameContainingAndStartDateGreaterThanEqual("TicketMaster", start_date,
						new PageRequest(0, 10));
		assertThat(employees.getTotalElements()).isEqualTo(3L);
	}
	
	@Test
	public void testSaveProject() {
		java.util.Date start_date = java.sql.Date.valueOf(LocalDate.parse("01/12/2018", formatter));
		java.util.Date end_date = java.sql.Date.valueOf(LocalDate.parse("06/12/2018", formatter));
		Project project = new Project("TicketMaster", "TicketMaster project", start_date, end_date, "Active");
		this.repository.save(project);
		Project projectFromDB = this.repository.findByNameContainingAndStartDateGreaterThanEqual("TicketMaster",
				start_date);
		assertEquals(project.getName(), projectFromDB.getName());
	}

}
