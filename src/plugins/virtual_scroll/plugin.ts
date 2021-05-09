/**
 * Plugin: "restore_on_backspace" (Tom Select)
 * Copyright (c) contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 * file except in compliance with the License. You may obtain a copy of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 */
import TomSelect from '../../tom-select.js';
import { TomOption } from '../../types/index';

type TPluginOptions = {
	text:(option:TomOption)=>string,
};


TomSelect.define('virtual_scroll',function(options:TPluginOptions) {
	const self						= this;
	const orig_canLoad				= self.canLoad;
	const orig_clearActiveOption	= self.clearActiveOption;
	const orig_loadCallback			= self.loadCallback;

	var pagination					= {};
	var dropdown_content;
	var loading_more				= false;


	if( !self.settings.firstUrl ){
		throw 'virtual_scroll plugin requires a firstUrl() method';
		return;
	}


	// in order for virtual scrolling to work,
	// options need to be ordered the same way they're returned from the remote data source
	self.settings.sortField			= [{field:'$order'},{field:'$score'}];


	// can we load more results for given query?
	function canLoadMore(query):boolean{

		if( typeof self.settings.maxOptions === 'number' && dropdown_content.children.length >= self.settings.maxOptions ){
			return;
		}

		if( (query in pagination) && pagination[query] ){
			return true;
		}

		return false;
	}


	// set the next url that will be
	self.setNextUrl = function(value:string,next_url:any):void{
		pagination[value] = next_url;
	};

	// getUrl() to be used in settings.load()
	self.getUrl = function(query:string):any{

		if( query in pagination ){
			const next_url = pagination[query];
			pagination[query] = false;
			return next_url;
		}

		// if the user goes back to a previous query
		// we need to load the first page again
		pagination = {};

		return self.settings.firstUrl(query);
	};

	// don't clear the active option (and cause unwanted dropdown scroll)
	// while loading more results
	self.hook('instead','clearActiveOption',()=>{

		if( loading_more ){
			return;
		}

		return orig_clearActiveOption.call(self);
	});

	// override the canLoad method
	self.hook('instead','canLoad',(query:string)=>{

		// first time the query has been seen
		if( !(query in pagination) ){
			return orig_canLoad.call(this,query);
		}

		return canLoadMore(query);
	});


	// wrap the load
	self.hook('instead','loadCallback',(value:string, options:TomOption[], optgroups:TomOption[])=>{

		if( !loading_more ){
			self.clearOptions();
		}

		orig_loadCallback.call( self, value, options, optgroups);

		loading_more = false;
	});


	// add templates to dropdown
	//	loading_more if we have another url in the queue
	//	no_more_results if we don't have another url in the queue
	self.hook('after','refreshOptions',()=>{

		const query		= self.lastValue;

		if( canLoadMore(query) ){
			var option = self.render('loading_more',{query:query});
			option.setAttribute('data-selectable',''); // so that navigating dropdown with [down] keypresses can navigate to this node
			option.classList.add(self.settings.optionClass);
			dropdown_content.append( option );

		}else if( (query in pagination) && !dropdown_content.querySelector('.no-results') ){
			dropdown_content.append( self.render('no_more_results',{query:query}) );
		}

	});


	// add scroll listener and default templates
	self.hook('after','setup',()=>{
		dropdown_content = self.dropdown_content;

		// default templates
		self.settings.render = Object.assign({}, {
			loading_more:function(data,escape){
				return `<div>Loading more results ... </div>`;
			},
			no_more_results:function(data,escape){
				return `<div>No more results</div>`;
			}
		},self.settings.render);


		// watch dropdown content scroll position
		dropdown_content.addEventListener('scroll',function(){

			const scroll_percent = dropdown_content.clientHeight / (dropdown_content.scrollHeight - dropdown_content.scrollTop);
			if( scroll_percent < 0.95 ){
				return;
			}

			// !important: this will get checked again in load() but we still need to check here otherwise loading_more will be set to true
			if( !canLoadMore(self.lastValue) ){
				return;
			}

			// don't call load() too much
			if( loading_more ) return;


			loading_more = true;
			self.load.call(self,self.lastValue);
		});
	});

});
