package com.sevis.cad;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.sevis.cad.domain.Employee;
import com.sevis.cad.domain.Project;
import com.sevis.cad.service.EmployeeRepository;
import com.sevis.cad.service.ProjectRepository;

@Component
public class Initializer implements ApplicationRunner {

	private EmployeeRepository mtoEmployeeRepository;

	private ProjectRepository mtoProjectRepository;
	DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MM/dd/yyyy");


	@Autowired
	public Initializer(EmployeeRepository mtoEmployeeRepository, ProjectRepository mtoProjectRepository) {
		this.mtoEmployeeRepository = mtoEmployeeRepository;
		this.mtoProjectRepository = mtoProjectRepository;
	}


	@Override
	public void run(ApplicationArguments args) throws Exception {
		String dob="06/17/1987";
		java.util.Date date = java.sql.Date.valueOf(LocalDate.parse(dob, formatter));
		Employee mtoEmployee = new Employee("Steven", "King", date, "Male", 123456789l, "Enginner", 2000l);
		mtoEmployeeRepository.save(mtoEmployee);
		java.util.Date start_date = java.sql.Date.valueOf(LocalDate.parse("01/12/2018", formatter));
		java.util.Date end_date = java.sql.Date.valueOf(LocalDate.parse("06/12/2018", formatter));
		Project mtoProject = new Project("NewProject", "NewProject description", start_date, end_date, "Active");
		mtoProjectRepository.save(mtoProject);
	}
}
