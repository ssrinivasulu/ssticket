/*
 * Copyright 2012-2015 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.sevis.cad.service;

import java.util.Date;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.rest.core.annotation.RepositoryRestResource;

import com.sevis.cad.domain.Project;

import io.swagger.annotations.ApiOperation;

/**
 * @author ssrinivasulu
 *
 */
@RepositoryRestResource(collectionResourceRel = "projects", path = "projects")
public interface ProjectRepository extends PagingAndSortingRepository<Project, Long> {

	@ApiOperation("find all Projects by their  matching name and start_date")
	Page<Project> findAllByNameContainingAndStartDateGreaterThanEqual(
			@Param("name") String name, @Param("start_date") Date startDate,
			Pageable pageable);
	
	@ApiOperation("find an Project by their matching name and start_date")
	Project findByNameContainingAndStartDateGreaterThanEqual(@Param("name") String name, 
			@Param("start_date") Date startDate);

}
