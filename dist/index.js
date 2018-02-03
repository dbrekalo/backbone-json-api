(function(root, factory) {

    /* istanbul ignore next */
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'backbone', 'underscore'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('jquery'), require('backbone'), require('underscore'));
    } else {
        root.backboneJsonApi = factory(root.jQuery, root.Backbone, root._);
    }

}(this, function($, Backbone, _) {

    var EntityCollection, EntityModel, IncludedCollection;

    IncludedCollection = Backbone.Collection.extend({

        modelId: function(attributes) {

            return attributes._type + '@' + attributes.id;

        },

        retrieve: function(type, id) {

            var model = this.find(function(includedModel) {
                return includedModel.getType() === type && includedModel.get('id') === id;
            });

            if (model && !model.includedCollection) {
                model.includedCollection = this.clone();
            }

            return model;

        }

    });

    EntityModel = Backbone.Model.extend({

        constructor: function(attributes, options, beforeInitialize) {

            this.apiData = {data: {}, included: []};
            this.includedArray = [];

            attributes = attributes || {};

            if (attributes.id) {
                this.apiData.data.id = attributes.id;
            }

            if (this.type) {
                this.apiData.data.type = this.type;
            }

            if (attributes._type) {
                this.apiData.data.type = attributes._type;
            }

            var initalizeRef = this.initialize;
            this.initialize = function() {};

            Backbone.Model.call(this, attributes, options);

            beforeInitialize && beforeInitialize.call(this, this);

            initalizeRef.apply(this, arguments);

        },

        getType: function() {

            return this.apiData.data.type;

        },

        setType: function(type) {

            this.apiData.data.type = type;
            return this;

        },

        unset: function(key) {

            if (key === 'id') {
                delete this.apiData.data.id;
            }

            return Backbone.Model.prototype.unset.apply(this, arguments);

        },

        buildIncludedCollection: function() {

            if (!this.includedCollection) {

                var includedModels = _.map(this.includedArray, function(item) {
                    var model = EntityModel.createFromData({data: item}, {assignIncludes: false});
                    model.includedArray = this.includedArray;
                    return model;
                }, this);

                this.includedCollection = new IncludedCollection([this].concat(includedModels));

                if (this.sourceCollection) {
                    this.sourceCollection.each(function(model) {
                        model.includedCollection = this.includedCollection.clone();
                    }, this);
                }

            }

            return this;

        },

        get: function(attribute) {

            var queryTree = _.isArray(attribute) ? attribute : attribute.split('.');
            var currentQuery = queryTree[0];
            var result;

            if (this.apiData.data.relationships && this.apiData.data.relationships[currentQuery]) {

                result = this.getRelation(currentQuery);

                if (typeof result !== 'undefined') {

                    if (queryTree.length === 2 && result instanceof EntityCollection) {
                        return result.pluck(queryTree[1]);
                    } else if (queryTree.length > 1) {
                        queryTree.shift();
                        return result.get(queryTree);
                    }

                }

            } else {
                result = Backbone.Model.prototype.get.call(this, currentQuery);
            }

            return result;

        },

        getRelation: function(name) {

            var relation = this.apiData.data.relationships[name];
            var relationData = relation && relation.data;

            if (!relationData) {

                return undefined;

            } else if (_.isArray(relationData)) {

                this.buildIncludedCollection();

                return new EntityCollection(_.map(relationData, function(item) {
                    return this.includedCollection.retrieve(item.type, item.id);
                }, this));

            } else {

                this.buildIncludedCollection();

                return this.includedCollection.retrieve(relationData.type, relationData.id);

            }

        },

        getRelationReferences: function(relationName) {

            if (this.apiData.data.relationships && this.apiData.data.relationships[relationName]) {

                var relationData = this.apiData.data.relationships[relationName].data;

                if (_.isArray(relationData)) {
                    return relationData.length ? _.pluck(relationData, 'id') : undefined;
                } else {
                    return relationData && relationData.id ? relationData.id : undefined;
                }

            } else {

                return undefined;

            }

        },

        setRelation: function(relationName, relationData) {

            var ref = this.apiData.data;

            ref.relationships = ref.relationships || {};

            this.buildIncludedCollection();

            _.each(_.isObject(relationName) ? relationName : _.object([relationName], [relationData]), function(data, name) {

                if (data instanceof EntityModel) {

                    data = {'type': data.getType(), 'id': data.get('id')};
                    this.includedCollection.add(data, {merge: true});

                } else if (data instanceof EntityCollection) {

                    data = data.map(function(model) {
                        return {'type': model.getType(), 'id': model.get('id')};
                    });
                    this.includedCollection.add(data.models, {merge: true});

                }

                ref.relationships[name] = ref.relationships[name] || {};
                ref.relationships[name].data = data;

            }, this);

            return this;

        },

        saveOnly: function(data) {

            var model = this;
            var deferred;
            var options = this.preparePersistedKeys(data);

            if (data.relations && !_.isArray(data.relations)) {
                this.setRelation(data.relations);
            }

            if (data.files) {
                options.files = data.files;
            }

            deferred = this.save(_.isArray(data.attributes) ? null : data.attributes, options);

            data.afterSave && deferred.done(function() {
                data.afterSave(model);
            });

            return deferred;

        },

        saveAttribute: function(name, value) {

            typeof value !== 'undefined' && this.set(name, value);

            return this.saveOnly({attributes: [name]});

        },

        saveFile: function(name, file) {

            if (typeof file !== 'undefined') {
                var filesData = {};
                filesData[name] = file;
            } else {
                filesData = name;
            }

            return this.saveOnly({files: filesData});

        },

        saveRelation: function(relationName, relationData) {

            relationData && this.setRelation(relationName, relationData);

            return this.saveOnly({relations: [relationName]});

        },

        preparePersistedKeys: function(data) {

            var options = {};

            if (data.attributes) {
                options.persistedAttributes = _.isArray(data.attributes) ? data.attributes : _.keys(data.attributes);
            } else {
                options.persistedAttributes = [];
            }

            if (data.relations) {
                if (_.isArray(data.relations)) {
                    options.persistedRelations = data.relations;
                } else {
                    options.persistedRelations = _.keys(data.relations);
                }
            } else {
                options.persistedRelations = [];
            }

            return options;

        },

        prepareSyncData: function(options) {

            var data = _.extend({}, _.pick(this.apiData.data, ['type', 'id']));

            var attributesSubset = this.persistedAttributes || options.persistedAttributes;
            var attributes = attributesSubset ? _.pick(this.attributes, attributesSubset) : this.attributes;

            attributes = _.omit(attributes, ['id', '_type']);

            if (!_.isEmpty(attributes)) {
                data.attributes = attributes;
            }

            var relationsSubset = this.persistedRelations || options.persistedRelations;
            var relations = relationsSubset ? _.pick(this.apiData.data.relationships, relationsSubset) : this.apiData.data.relationships;

            if (!_.isEmpty(relations)) {
                data.relationships = relations;
            }

            if (options.files && !_.isEmpty(options.files)) {
                data.files = options.files;
            }

            return data;

        },

        sync: function(method, model, options) {

            var methodMap = {
                create: 'POST',
                update: 'PUT',
                patch: 'PATCH',
                'delete': 'DELETE',
                read: 'GET'
            };

            // Default JSON-request options.
            var params = {
                type: methodMap[method],
                dataType: 'json',
                url: _.result(model, 'url'),
                processData: false
            };

            // Ensure that we have the appropriate request data.
            if (!options.data && model && (method === 'create' || method === 'update' || method === 'patch')) {

                var dataToSync = this.prepareSyncData(options);

                if (dataToSync.files) {

                    var formData = new FormData();

                    formData.append('data', JSON.stringify(_.omit(dataToSync, 'files')));

                    _.each(dataToSync.files, function(file, fileName) {
                        formData.append(fileName, file);
                    });

                    _.extend(params, {
                        type: 'POST',
                        contentType: false,
                        data: formData
                    });

                } else {

                    _.extend(params, {
                        contentType: 'application/vnd.api+json',
                        data: JSON.stringify({data: dataToSync})
                    });

                }
            }

            // Make the request, allowing the user to override any Ajax options.
            var xhr = options.xhr = $.ajax(_.extend(params, options));
            model.trigger('request', model, xhr, options);

            return xhr;

        },

        urlRoot: function() {

            return '/api/' + this.getType();

        },

        parse: function(response, options) {

            _.extend(this.apiData, response);

            var attributes = response.data.attributes || {};

            if (response.data.id) {
                attributes.id = response.data.id;
            }

            if (response.data.type) {
                attributes._type = response.data.type;
            }

            delete this.includedCollection;
            this.includedArray = [response.data].concat(response.included || []);

            return attributes;

        },

    }, {

        apiUrl: function(resourceName, resourceId) {

            return '/api/' + resourceName + (resourceId ? '/' + resourceId : '');

        },

        getType: function() {

            return this.prototype.type;

        },

        getFromApi: function(options, callback, callbackContext) {

            options = _.extend({resourceName: this.type}, options);

            var Model = this;
            var resourceName = options.resourceName || options.type || Model.getType();
            var url = options.url || Model.apiUrl(resourceName, options.id);
            var deferred = $.Deferred();

            $.get(url, function(apiData) {
                var model = Model.createFromData(apiData);
                callback && callback.call(callbackContext || this, model, apiData);
                deferred.resolve(model);
            }).fail(function(data) {
                deferred.reject(data);
            });

            return deferred;

        },

        createFromData: function(apiData, options) {

            apiData.data = apiData.data || {};
            options = _.extend({assignIncludes: true}, options);

            var Model = this;
            var attributes = apiData.data.attributes || {};

            if (apiData.data.id) {
                attributes.id = apiData.data.id;
            }

            if (apiData.data.type) {
                attributes._type = apiData.data.type;
            }

            return new Model(attributes, options, function(model) {

                _.extend(model.apiData, apiData);

                if (options.assignIncludes) {
                    model.includedArray = [apiData.data].concat(apiData.included || []);
                }

            });

        },

        create: function(attributes, options) {

            var Model = this;
            return new Model(attributes, options);

        }

    });

    EntityCollection = Backbone.Collection.extend({

        fetch: function() {

            return EntityCollection.getFromApi({url: this.url || this.apiUrl}, function(collection) {
                this.set(collection.models);
            }, this);

        }

    }, {

        apiUrl: function(resourceName, params) {

            return '/api/' + resourceName;

        },

        getFromApi: function(options, callback, callbackContext) {

            if (typeof options === 'string') {
                options = {resourceName: options};
            }

            var Collection = this;
            var url = options.url || Collection.apiUrl(options.resourceName || options.type, options);
            var deferred = $.Deferred();

            $.get(url, function(apiData) {
                var collection = Collection.createFromData(apiData, options);
                collection.apiUrl = url;
                callback && callback.call(callbackContext || this, collection, apiData);
                deferred.resolve(collection);
            }).fail(function(data) {
                deferred.reject(data);
            });

            return deferred;

        },

        createFromData: function(apiData, options) {

            var Collection = this;
            var Model = options && options.Model || EntityModel;
            var includedArray = apiData.data.concat(apiData.included || []);

            var models = _.map(apiData.data, function(item) {
                var model = Model.createFromData({data: item}, {assignIncludes: false});
                model.includedArray = includedArray;
                return model;
            });

            var collection = new Collection(models, options);

            collection.each(function(model) {
                model.sourceCollection = collection;
            });

            collection.apiData = apiData;

            return collection;

        }

    });

    return {
        Model: EntityModel,
        Collection: EntityCollection
    };

}));
