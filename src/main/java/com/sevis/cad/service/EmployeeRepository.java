package com.sevis.cad.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

import com.sevis.cad.domain.Employee;

import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiResponse;
import io.swagger.annotations.ApiResponses;

/**
 * @author ssrinivasulu
 *
 */
@Api(tags = "Employee Entity")
@RepositoryRestResource(collectionResourceRel = "employees", path = "employees")
public interface EmployeeRepository extends PagingAndSortingRepository<Employee, Long> {

	@ApiOperation("find all Employees by their matching firstname and last name")
	Page<Employee> findByfirstNameContainingAndLastNameContainingAllIgnoringCase(
			@Param("firstName") String name, @Param("lastName") String country,
			Pageable pageable);

	@ApiOperation("find an Employee by their matching firstname and last name")
	Employee findByfirstNameAndLastNameAllIgnoringCase(@Param("firstName") String name,
			@Param("lastName") String country);
	
	@Override
    @SuppressWarnings("unchecked")
	@ApiOperation("saves a new Employee")
	@ApiResponses({@ApiResponse(code = 201, message = "Created", response = Employee.class)})
	Employee save(Employee employee);

}
