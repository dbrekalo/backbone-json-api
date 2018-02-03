var assert = require('chai').assert;
var $ = require('jquery');
var FakeServer = require('fake-json-api-server');
var fakeServerConfig = require('./fakeServerConfig');
var jsonApiResource = require('../');
var Model = jsonApiResource.Model;
var Collection = jsonApiResource.Collection;

var apiUrl = window.location.href + '/api';
var fakeServer;

var oldModelStaticApiUrl = Model.apiUrl;
var oldModelPrototypeUrlRoot = Model.prototype.urlRoot;
var oldCollectionStaticApiUrl = Collection.apiUrl;

Model.apiUrl = function(resourceName, resourceId) {
    return window.location.href + oldModelStaticApiUrl.call(Model, resourceName, resourceId);
};

Model.prototype.urlRoot = function() {
    return window.location.href + oldModelPrototypeUrlRoot.call(this);
};

Collection.apiUrl = function(resourceName, params) {
    return window.location.href + oldCollectionStaticApiUrl.call(Collection, resourceName, params);
};

beforeEach(function() {
    fakeServer = new FakeServer(fakeServerConfig);
});

afterEach(function() {
    fakeServer && fakeServer.stop();
});

describe('Creating models from server data', function() {

    it('model can be created from api call', function(done) {

        Model.getFromApi({type: 'article', id: '1'}, function(model) {

            assert.isTrue(model instanceof Model);
            assert.equal(model.getType(), 'article');
            assert.strictEqual(model.get('id'), '1');
            done();

        });

    });

    it('extended model can be created from api call', function(done) {

        Model.extend({type: 'tag'}).getFromApi({id: '1'}, function(model) {

            assert.isTrue(model instanceof Model);
            assert.equal(model.getType(), 'tag');
            assert.strictEqual(model.get('id'), '1');
            done();

        });

    });

    it('model can be created from data', function(done) {

        $.get(apiUrl + '/article/1', function(apiData) {

            var model = Model.createFromData(apiData);

            assert.instanceOf(model, Model);
            assert.equal(model.getType(), 'article');
            assert.strictEqual(model.get('id'), '1');
            done();

        });

    });

    it('model retrives includes', function(done) {

        Model.getFromApi({resourceName: 'article', id: 1}, function(model) {

            assert.instanceOf(model.get('author'), Model);
            assert.instanceOf(model.get('tags'), Collection);
            assert.strictEqual(model.get('author'), model.get('author'));
            done();

        });

    });

    it('model retrives properties', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            assert.equal(model.get('title'), 'Article title 1');
            assert.equal(model.get('author.id'), '1');
            assert.equal(model.get('author.email'), 'test.user1@gmail.com');
            assert.deepEqual(model.get('tags').pluck('id'), ['1', '2', '3']);
            assert.deepEqual(model.get('tags.id'), ['1', '2', '3']);
            assert.isUndefined(model.get('publisher'));
            assert.isUndefined(model.get('publisher.email'));
            assert.isUndefined(model.get('undefinedRelation.title'));
            assert.isUndefined(model.get('undefinedAttribute'));

            done();

        });

    });

    it('model retrives relation references', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            assert.equal(model.getRelationReferences('author'), '1');
            assert.equal(model.getRelationReferences('publisher'), undefined);
            assert.equal(model.getRelationReferences('undefinedRelation'), undefined);
            assert.deepEqual(model.getRelationReferences('tags'), ['1', '2', '3']);
            done();

        });

    });

    it('model properly unsets id attribute', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            model.unset('id');
            assert.isTrue(model.isNew());
            done();

        });

    });

    it('fails when api fails', function(done) {

        Model.getFromApi({resourceName: 'undefinedResource', id: 1}).fail(function() {
            done();
        });

    });

});

describe('Saving json api model', function() {

    it('model sets and saves attribute only', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            model.set('title', 'New article title').saveAttribute('title').done(function() {
                assert.equal(model.get('title'), 'New article title');
                done();
            });

        });

    });

    it('model sets and saves attribute in same call', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            model.saveAttribute('title', 'New article title').done(function() {
                assert.equal(model.get('title'), 'New article title');
                done();
            });

        });

    });

    it('model saves specific attribute only', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            model.set('title', 'New article title').saveOnly({
                attributes: ['title']
            }).done(function() {
                assert.equal(model.get('title'), 'New article title');
                done();
            });

        });

    });

    it('model saves multiple attributes', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            model.saveOnly({
                attributes: {title: 'New article title', leadTitle: 'New article lead'},
                afterSave: function(savedModel) {
                    assert.equal(model.get('title'), 'New article title');
                    assert.equal(model.get('leadTitle'), 'New article lead');
                    done();
                }
            });

        });

    });

    it('model saves via standard backbone save call', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            model.set('title', 'New article title').save().done(function() {
                assert.equal(model.get('title'), 'New article title');
                done();
            });

        });

    });

    it('saves hasMany relation', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var currentTags = model.get('tags');
            var newTags = new Collection(currentTags.slice(0, 2));

            model.saveRelation('tags', newTags).done(function() {
                assert.equal(model.get('tags').length, 2);
                done();
            });

        });

    });

    it('saves hasOne relation', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var author = model.get('author');
            var authorId = author.get('id');

            model.saveRelation('publisher', author).done(function() {
                assert.equal(model.get('publisher.id'), authorId);
                done();
            });

        });

    });

    it('saves multiple relations', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var author = model.get('author');
            var authorId = author.get('id');

            var currentTags = model.get('tags');
            var newTags = new Collection(currentTags.slice(0, 2));

            model.saveOnly({
                relations: {
                    publisher: author,
                    tags: newTags
                }
            }).done(function() {
                assert.equal(model.get('publisher.id'), authorId);
                assert.equal(model.get('tags').length, 2);
                done();
            });

        });

    });

    it('saves multiple relations', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var author = model.get('author');
            var authorId = author.get('id');

            var currentTags = model.get('tags');
            var newTags = new Collection(currentTags.slice(0, 2));
            var newTagsIds = newTags.pluck('id');

            model.saveOnly({
                relations: {
                    publisher: author,
                    tags: newTags
                }
            }).done(function() {
                assert.equal(model.get('publisher.id'), authorId);
                assert.deepEqual(model.get('tags').pluck('id'), newTagsIds);
                done();
            });

        });

    });

    it('extends and saves new model', function(done) {

        Model.extend({type: 'tag'}).create().saveOnly({
            attributes: {title: 'New tag'},
            afterSave: function(model) {

                assert.isDefined(model.get('id'));
                assert.equal(model.get('title'), 'New tag');
                done();

            }
        });

    });

    it('creates and saves new model', function(done) {

        var model = Model.create({title: 'New tag'}).setType('tag');

        model.save().done(function() {
            assert.isDefined(model.get('id'));
            assert.equal(model.get('title'), 'New tag');
            done();
        });

    });

    it('saves files payload', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var handler = function(request) {
                assert.strictEqual(request.requestBody.get('test'), 'somefile.jpg');
                fakeServer.off('request', handler);
                done();
            };

            fakeServer.on('request', handler);

            model.saveFile({test: 'somefile.jpg'});

        });

    });

    it('saves files payload with altenate syntax', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var handler = function(request) {
                assert.strictEqual(request.requestBody.get('test'), 'somefile.jpg');
                fakeServer.off('request', handler);
                done();
            };

            fakeServer.on('request', handler);

            model.saveFile('test', 'somefile.jpg');

        });

    });

    it('saves files payload alongside attributes', function(done) {

        Model.getFromApi({type: 'article', id: 1}, function(model) {

            var handler = function(request) {
                assert.strictEqual(request.requestBody.get('test'), 'somefile.jpg');
                fakeServer.off('request', handler);
            };

            fakeServer.on('request', handler);

            model.saveOnly({
                attributes: {title: 'New article title'},
                files: {test: 'somefile.jpg'},
                afterSave: function(savedModel) {
                    assert.equal(model.get('title'), 'New article title');
                    done();
                }
            });

        });

    });

});

describe('Creating collections from server data', function() {

    it('collection is created via api call', function(done) {

        Collection.getFromApi('article', function(collection) {

            assert.instanceOf(collection, Collection);
            collection.each(function(articleModel) {
                assert.isDefined(articleModel.get('id'));
                assert.isDefined(articleModel.get('author.id'));
            });
            done();

        });

    });

    it('collection is created via api call with url', function(done) {

        Collection.getFromApi({
            url: apiUrl + '/article?page[offset]=0&page[limit]=4'
        }, function(collection) {

            assert.instanceOf(collection, Collection);
            assert.equal(collection.length, 4);
            done();

        });

    });

    it('multiple collections created via api call', function(done) {

        $.when(
            Collection.getFromApi('article'),
            Collection.getFromApi('tag')
        ).done(function(articleCollection, tagCollection) {
            assert.instanceOf(articleCollection, Collection);
            assert.instanceOf(tagCollection, Collection);
            done();
        });

    });

    it('collection fetch works as intended', function(done) {

        Collection.getFromApi('article', function(collection) {

            collection.at(0).set('title', 'Changed title');

            collection.on('change', function(article) {
                assert.equal(article.previous('title'), 'Changed title');
                done();
            });

            collection.fetch();

        });

    });

    it('collection is created from api data', function(done) {

        $.get(apiUrl + '/article?page[offset]=0&page[limit]=4', function(apiData) {

            var collection = Collection.createFromData(apiData);

            assert.instanceOf(collection, Collection);
            assert.equal(collection.length, 4);
            done();

        });

    });

    it('collection fails when api fails', function(done) {

        Collection.getFromApi({type: 'undefinedResource'}).fail(function() {
            done();
        });

    });

});
