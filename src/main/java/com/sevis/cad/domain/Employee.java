package com.sevis.cad.domain;

import java.io.Serializable;
import java.util.Date;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.SequenceGenerator;
import javax.persistence.Table;

/**
 * @author ssrinivasulu
 *
 */
@Entity
@Table(name = "employee")
public class Employee implements Serializable {

	private static final long serialVersionUID = 1L;

	@Id
	@SequenceGenerator(name = "employee_generator", sequenceName = "employee_sequence", initialValue = 23)
	@GeneratedValue(generator = "employee_generator")
	private Long id;

	@Column(name = "firstname", length = 50, nullable = false)
	private String firstName;
	
	@Column(name = "lastname", length = 50, nullable = false)
	private String lastName;
	
	@Column(name = "dob", nullable = false)
	private Date dob;
	
	@Column(name = "sex", nullable = false)
	private String sex;
	
	@Column(name = "phonenumber", nullable = false)
	private Long phoneNumber;

	@Column(name = "designation", nullable = false)
	private String designation;
	
	@Column(name = "salary", nullable = false)
	private Long salary;

	//firstname, lastname, dob, sex, phonenumber, designation, salary
	protected Employee() {
	}

	public Employee(String firstName, String lastName, Date dob, 
			String sex, Long phoneNumber, String designation, Long salary) {
		this.firstName = firstName;
		this.lastName = lastName;
		this.dob = dob;
		this.sex = sex;
		this.phoneNumber = phoneNumber;
		this.designation = designation;
		this.salary = salary;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public Date getDob() {
		return dob;
	}

	public void setDob(Date dob) {
		this.dob = dob;
	}

	public String getSex() {
		return sex;
	}

	public void setSex(String sex) {
		this.sex = sex;
	}

	public Long getPhoneNumber() {
		return phoneNumber;
	}

	public void setPhoneNumber(Long phoneNumber) {
		this.phoneNumber = phoneNumber;
	}

	public String getDesignation() {
		return designation;
	}

	public void setDesignation(String designation) {
		this.designation = designation;
	}

	public Long getSalary() {
		return salary;
	}

	public void setSalary(Long salary) {
		this.salary = salary;
	}

	@Override
	public String toString() {
		return getFirstName() + "," + getLastName() + "," + 
				getDob()  + "," + getSex() + "," + getPhoneNumber() + "," + getSex() + "," + 
				getDesignation()  + "," + getSalary();
	}

}
