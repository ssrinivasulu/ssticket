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

import com.sevis.cad.domain.Employee;
import com.sevis.cad.service.EmployeeRepository;

/**
 * @author ssrinivasulu
 *
 */
@RunWith(SpringRunner.class)
@SpringBootTest
public class EmployeeRepositoryIntegrationTests {

	@Autowired
	EmployeeRepository repository;
	
	DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM/dd/yyyy");

	@Test
	public void findsFirstPageOfEmployees() {
		Page<Employee> employees = this.repository.findAll(new PageRequest(0, 10));
		assertThat(employees.getTotalElements()).isGreaterThan(20L);
	}

	@Test
	public void findByNameAndCountry() {
		Employee employee = this.repository.findByfirstNameAndLastNameAllIgnoringCase("Santhosh",
				"Srinivasulu");
		assertThat(employee).isNotNull();
		assertThat(employee.getFirstName()).isEqualTo("Santhosh");
	}

	@Test
	public void findContaining() {
		Page<Employee> employees = this.repository
				.findByfirstNameContainingAndLastNameContainingAllIgnoringCase("", "UK",
						new PageRequest(0, 10));
		assertThat(employees.getTotalElements()).isEqualTo(3L);
	}
	
	@Test
	public void saveEmployee() {
		String dob="06/17/1987";
		java.util.Date date = java.sql.Date.valueOf(LocalDate.parse(dob, formatter));
		Employee employee = new Employee("Steven", "King", date, "Male", 123456789l, "Enginner", 2000l);
		this.repository.save(employee);
		Employee employeeFromDB = this.repository.findByfirstNameAndLastNameAllIgnoringCase("Steven",
				"King");
		assertEquals(employee.getFirstName(), employeeFromDB.getFirstName());
	}

}
